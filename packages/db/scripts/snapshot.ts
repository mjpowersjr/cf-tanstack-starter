/**
 * Pulls a snapshot of the production D1 database, wipes the local D1 state,
 * and restores the snapshot locally so dev mirrors prod.
 *
 * The snapshot includes the `__drizzle_migrations` tracking table, so a
 * subsequent `pnpm db:migrate:local` correctly applies only undeployed
 * migrations on top.
 *
 * Stop the dev server before running — the local D1 sqlite file is held open
 * by miniflare and can't be replaced while dev is running.
 *
 * Usage: tsx scripts/snapshot.ts
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const wranglerCwd = resolve(repoRoot, "apps/web");
const localD1StateDir = resolve(wranglerCwd, ".wrangler/state/v3/d1");
const snapshotPath = resolve(wranglerCwd, "db-snapshot.sql");

function wrangler(args: string) {
  execSync(`wrangler ${args}`, { cwd: wranglerCwd, stdio: "inherit" });
}

console.log("Exporting remote D1 to snapshot...");
wrangler(`d1 export DB --remote --output ${snapshotPath}`);

if (existsSync(localD1StateDir)) {
  console.log("Wiping local D1 state...");
  rmSync(localD1StateDir, { recursive: true, force: true });
}

// Wrangler executes --file statements one at a time on fresh connections,
// so a leading `PRAGMA foreign_keys=OFF` doesn't persist for subsequent
// inserts. The export also dumps tables in a non-FK-respecting order
// (e.g. `account`/`session` are dumped before `user`, but they reference
// `user`). To make the file replayable statement-by-statement, reorder so
// all schema (CREATE/PRAGMA) is applied first and all inserts come after.
console.log("Restoring snapshot to local D1...");
const snapshot = readFileSync(snapshotPath, "utf8");
const reordered = reorderSnapshot(snapshot);
writeFileSync(snapshotPath, reordered);
wrangler(`d1 execute DB --local --file ${snapshotPath}`);

function reorderSnapshot(sql: string): string {
  // Split on `;` followed by newline. Statements are top-level only —
  // CREATE TABLE blocks span lines but always end with `);\n`.
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const schema: string[] = [];
  const inserts: string[] = [];
  for (const stmt of statements) {
    if (/^INSERT\s/i.test(stmt)) inserts.push(stmt);
    else schema.push(stmt);
  }
  return `${[...schema, ...inserts].join(";\n")};\n`;
}

console.log("Done. Run `pnpm db:migrate:local` to apply any undeployed migrations.");
