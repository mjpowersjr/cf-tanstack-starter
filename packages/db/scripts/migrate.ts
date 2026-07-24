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
 * Each migration is applied together with its tracking INSERT in a single
 * `wrangler d1 execute --file` invocation, so a crash between "apply" and
 * "record" can't leave an applied-but-unrecorded migration behind.
 *
 * Usage: tsx scripts/migrate.ts --local | --remote [--env <wrangler-env>]
 *   --env selects a wrangler environment (e.g. `--env staging` migrates the
 *   staging database). Omit it for the top-level (production) config.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const target = args[0];
if (target !== "--local" && target !== "--remote") {
  console.error("Usage: migrate.ts --local | --remote [--env <wrangler-env>]");
  process.exit(1);
}
let envName: string | undefined;
const envIdx = args.indexOf("--env");
if (envIdx !== -1) {
  envName = args[envIdx + 1];
  if (!envName) {
    console.error("--env requires a value (e.g. --env staging)");
    process.exit(1);
  }
}
const envArgs = envName ? ["--env", envName] : [];

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const migrationsDir = resolve(__dirname, "../drizzle");
const wranglerCwd = resolve(repoRoot, "apps/web");

function wrangler(extra: string[]): string {
  return execFileSync("wrangler", ["d1", "execute", "DB", target, ...envArgs, ...extra], {
    cwd: wranglerCwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function ensureMigrationsTable() {
  wrangler([
    "--command",
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric, name text, applied_at TEXT)",
  ]);
}

function getAppliedNames(): Set<string> {
  const out = wrangler(["--command", "SELECT name FROM __drizzle_migrations", "--json"]);
  const parsed = JSON.parse(out) as Array<{ results: Array<{ name: string | null }> }>;
  return new Set(
    (parsed[0]?.results ?? []).map((r) => r.name).filter((n): n is string => n !== null),
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

// `wrangler d1 execute --file` splits on semicolons, not on drizzle's
// `--> statement-breakpoint` markers. A statement with an internal semicolon
// (e.g. a CREATE TRIGGER body) would be mis-split and corrupt the apply, so
// refuse to run it rather than guess.
function assertWranglerSplittable(name: string, sqlContent: string) {
  // The marker may appear inline after the `;` or on its own line.
  const statements = sqlContent.split(/-->\s*statement-breakpoint/);
  for (const stmt of statements) {
    const body = stmt
      .replace(/--[^\n]*/g, "")
      .trim()
      .replace(/;$/, "");
    if (body.includes(";")) {
      console.error(
        `Migration ${name} contains a statement with an internal semicolon ` +
          `(trigger body / multi-statement construct). wrangler's --file splitting ` +
          `would corrupt it — apply this migration with drizzle-kit migrate instead, ` +
          `then record it manually in __drizzle_migrations.`,
      );
      process.exit(1);
    }
  }
}

console.log(
  `Running migrations against ${target.replace("--", "")} D1${envName ? ` (env: ${envName})` : ""}...`,
);

ensureMigrationsTable();
const applied = getAppliedNames();

const migrations = readdirSync(migrationsDir)
  .filter((name) => {
    const full = join(migrationsDir, name);
    return statSync(full).isDirectory() && /^\d+_/.test(name);
  })
  .sort();

let applyCount = 0;
const tmpDir = mkdtempSync(join(tmpdir(), "d1-migrate-"));
try {
  for (const name of migrations) {
    if (applied.has(name)) continue;
    const sqlPath = join(migrationsDir, name, "migration.sql");
    const sqlContent = readFileSync(sqlPath, "utf8");
    assertWranglerSplittable(name, sqlContent);

    let migrationSql = sqlContent.trimEnd();
    if (!migrationSql.endsWith(";")) migrationSql += ";";
    const tracking = `INSERT INTO __drizzle_migrations (hash, created_at, name, applied_at) VALUES ('${migrationHash(sqlPath)}', ${folderMillis(name)}, '${sqlEscape(name)}', '${new Date().toISOString()}');`;
    const combinedPath = join(tmpDir, `${name}.sql`);
    writeFileSync(combinedPath, `${migrationSql}\n${tracking}\n`);

    console.log(`  applying ${name}...`);
    wrangler(["--file", combinedPath]);
    applyCount++;
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(
  applyCount === 0 ? "No new migrations to apply." : `Applied ${applyCount} migration(s).`,
);
