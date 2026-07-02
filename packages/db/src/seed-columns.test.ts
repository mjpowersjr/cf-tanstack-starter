import { readFileSync } from "node:fs";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { account, guestbookEntries, uploadedFiles, user } from "./schema";

/**
 * The seed script writes raw SQL, so nothing typechecks its column names
 * against the schema — a mismatch (e.g. snake_case vs drizzle's implicit
 * camelCase) aborts the whole seed at runtime. Cross-check every INSERT's
 * column list against the real schema.
 */
describe("seed-local.ts column names", () => {
  const TABLES: Record<string, Parameters<typeof getTableColumns>[0]> = {
    user,
    account,
    guestbook_entries: guestbookEntries,
    uploaded_files: uploadedFiles,
  };

  it("every INSERT column exists in the drizzle schema", () => {
    const src = readFileSync(`${import.meta.dirname}/../scripts/seed-local.ts`, "utf8");
    const inserts = [...src.matchAll(/INSERT (?:OR IGNORE )?INTO (\w+) \(([^)]+)\)/g)];
    expect(inserts.length).toBeGreaterThan(0);

    for (const [, tableName, colList] of inserts) {
      const table = TABLES[tableName];
      expect(table, `seed references unknown table "${tableName}"`).toBeDefined();

      const validColumns = new Set(Object.values(getTableColumns(table)).map((c) => c.name));
      for (const col of colList.split(",").map((s) => s.trim())) {
        expect(
          validColumns.has(col),
          `${tableName}.${col} does not exist — schema columns are: ${[...validColumns].join(", ")}`,
        ).toBe(true);
      }
    }
  });
});
