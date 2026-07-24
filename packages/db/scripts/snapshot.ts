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
 * Note: the snapshot file contains production data (emails, password hashes,
 * session tokens). It is gitignored — do not commit or share it.
 *
 * Usage: tsx scripts/snapshot.ts
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const wranglerCwd = resolve(repoRoot, "apps/web");
// NOTE: this wipes ALL local D1 databases (they share one state dir). Fine
// while the app has a single DB binding; revisit if more bindings are added.
const localD1StateDir = resolve(wranglerCwd, ".wrangler/state/v3/d1");
const snapshotPath = resolve(wranglerCwd, "db-snapshot.sql");

function wrangler(args: string[]) {
  execFileSync("wrangler", args, { cwd: wranglerCwd, stdio: "inherit" });
}

// Split SQL into statements on top-level semicolons, honoring single-quoted
// strings (with '' escapes), double-quoted identifiers, and line comments —
// user data like guestbook messages can legally contain `;` and newlines.
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      current += ch;
      i++;
      while (i < sql.length) {
        current += sql[i];
        if (sql[i] === ch) {
          if (sql[i + 1] === ch) {
            current += sql[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        current += sql[i];
        i++;
      }
      continue;
    }
    if (ch === ";") {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

// Wrangler executes --file statements one at a time on fresh connections,
// so a leading `PRAGMA foreign_keys=OFF` doesn't persist for subsequent
// inserts. The export also dumps tables in a non-FK-respecting order
// (e.g. `account`/`session` are dumped before `user`, but they reference
// `user`). To make the file replayable statement-by-statement, apply all
// schema (CREATE/PRAGMA) first, then inserts — with `user` rows first, since
// `user` is the only table other tables reference.
function reorderSnapshot(sql: string): string {
  const statements = splitSqlStatements(sql);
  const schema: string[] = [];
  const inserts: string[] = [];
  for (const stmt of statements) {
    if (/^INSERT\s/i.test(stmt)) inserts.push(stmt);
    else schema.push(stmt);
  }
  const tableOf = (stmt: string) =>
    /^INSERT\s+INTO\s+[`"[]?([A-Za-z0-9_]+)/i.exec(stmt)?.[1]?.toLowerCase();
  const userInserts = inserts.filter((s) => tableOf(s) === "user");
  const otherInserts = inserts.filter((s) => tableOf(s) !== "user");
  return `${[...schema, ...userInserts, ...otherInserts].join(";\n")};\n`;
}

console.log("Exporting remote D1 to snapshot...");
wrangler(["d1", "export", "DB", "--remote", `--output=${snapshotPath}`]);

if (existsSync(localD1StateDir)) {
  console.log("Wiping local D1 state...");
  rmSync(localD1StateDir, { recursive: true, force: true });
}

console.log("Restoring snapshot to local D1...");
const snapshot = readFileSync(snapshotPath, "utf8");
writeFileSync(snapshotPath, reorderSnapshot(snapshot));
wrangler(["d1", "execute", "DB", "--local", `--file=${snapshotPath}`]);

console.log("Done. Run `pnpm db:migrate:local` to apply any undeployed migrations.");
console.log(`Reminder: ${snapshotPath} contains production data — keep it local.`);
