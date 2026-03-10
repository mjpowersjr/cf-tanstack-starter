import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { guestbookEntries, uploadedFiles } from "./schema";

describe("database schema", () => {
  it("defines guestbook_entries table", () => {
    expect(getTableName(guestbookEntries)).toBe("guestbook_entries");
  });

  it("defines uploaded_files table", () => {
    expect(getTableName(uploadedFiles)).toBe("uploaded_files");
  });

  it("guestbook_entries has expected columns", () => {
    const columns = Object.keys(guestbookEntries);
    expect(columns).toContain("id");
    expect(columns).toContain("name");
    expect(columns).toContain("message");
    expect(columns).toContain("createdAt");
  });

  it("uploaded_files has expected columns", () => {
    const columns = Object.keys(uploadedFiles);
    expect(columns).toContain("id");
    expect(columns).toContain("filename");
    expect(columns).toContain("r2Key");
    expect(columns).toContain("contentType");
    expect(columns).toContain("size");
    expect(columns).toContain("createdAt");
  });
});
