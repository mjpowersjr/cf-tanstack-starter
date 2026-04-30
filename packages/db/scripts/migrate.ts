/**
 * Unified migration runner for local and remote D1.
 *
 * Reads drizzle's subdir migration format from packages/db/drizzle/* and
 * applies them via `wrangler d1 execute` with the same flags for both
 * environments. Tracks applied migrations in the standard __drizzle_migrations
 * table inside D1 itself, so state lives with the database rather than in a
 * journal file. This means a `wrangler d1 export` snapshot from production
 * carries the migration history with it — restoring locally and running new
 * migrations Just Works.
 *
 * Schema and hashing match drizzle-orm's d1 migrator exactly, so the table is
 * interchangeable with `drizzle-kit migrate` if anyone needs to switch tools.
 *
 * Usage: tsx scripts/migrate.ts --local | --remote
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (target !== "--local" && target !== "--remote") {
  console.error("Usage: migrate.ts --local | --remote");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const migrationsDir = resolve(__dirname, "../drizzle");
const wranglerCwd = resolve(repoRoot, "apps/web");

function wrangler(args: string): string {
  return execSync(`wrangler d1 execute DB ${target} ${args}`, {
    cwd: wranglerCwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function ensureMigrationsTable() {
  wrangler(
    `--command "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric, name text, applied_at TEXT)"`,
  );
}

function getAppliedNames(): Set<string> {
  const out = wrangler(`--command "SELECT name FROM __drizzle_migrations" --json`);
  const parsed = JSON.parse(out) as Array<{ results: Array<{ name: string | null }> }>;
  return new Set(
    (parsed[0]?.results ?? []).map((r) => r.name).filter((n): n is string => n !== null),
  );
}

function recordApplied(hash: string, folderMillis: number, name: string) {
  const appliedAt = new Date().toISOString();
  wrangler(
    `--command "INSERT INTO __drizzle_migrations (hash, created_at, name, applied_at) VALUES ('${hash}', ${folderMillis}, '${sqlEscape(name)}', '${appliedAt}')"`,
  );
}

function migrationHash(sqlPath: string): string {
  return createHash("sha256").update(readFileSync(sqlPath)).digest("hex");
}

// Drizzle's name-to-millis convention: first 14 chars are YYYYMMDDhhmmss in UTC.
function folderMillis(name: string): number {
  const ts = name.slice(0, 14);
  return Date.UTC(
    parseInt(ts.slice(0, 4), 10),
    parseInt(ts.slice(4, 6), 10) - 1,
    parseInt(ts.slice(6, 8), 10),
    parseInt(ts.slice(8, 10), 10),
    parseInt(ts.slice(10, 12), 10),
    parseInt(ts.slice(12, 14), 10),
  );
}

console.log(`Running migrations against ${target.replace("--", "")} D1...`);

ensureMigrationsTable();
const applied = getAppliedNames();

const migrations = readdirSync(migrationsDir)
  .filter((name) => {
    const full = join(migrationsDir, name);
    return statSync(full).isDirectory() && /^\d+_/.test(name);
  })
  .sort();

let applyCount = 0;
for (const name of migrations) {
  if (applied.has(name)) continue;
  const sqlPath = join(migrationsDir, name, "migration.sql");
  console.log(`  applying ${name}...`);
  wrangler(`--file "${sqlPath}"`);
  recordApplied(migrationHash(sqlPath), folderMillis(name), name);
  applyCount++;
}

console.log(
  applyCount === 0 ? "No new migrations to apply." : `Applied ${applyCount} migration(s).`,
);
