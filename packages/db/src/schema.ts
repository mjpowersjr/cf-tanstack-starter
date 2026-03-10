import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const guestbookEntries = sqliteTable("guestbook_entries", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  message: text().notNull(),
  createdAt: text()
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const uploadedFiles = sqliteTable("uploaded_files", {
  id: integer().primaryKey({ autoIncrement: true }),
  filename: text().notNull(),
  r2Key: text("r2_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer().notNull(),
  createdAt: text()
    .notNull()
    .default(sql`(current_timestamp)`),
});
