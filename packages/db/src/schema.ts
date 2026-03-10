import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// --- Auth tables (better-auth) ---

export const user = sqliteTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: "boolean" }).notNull().default(false),
  image: text(),
  createdAt: integer({ mode: "timestamp" }).notNull(),
  updatedAt: integer({ mode: "timestamp" }).notNull(),
  // username plugin
  username: text().unique(),
  displayUsername: text(),
  // admin plugin
  role: text().default("user"),
  banned: integer({ mode: "boolean" }).default(false),
  banReason: text(),
  banExpires: integer({ mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text().notNull().unique(),
  expiresAt: integer({ mode: "timestamp" }).notNull(),
  ipAddress: text(),
  userAgent: text(),
  createdAt: integer({ mode: "timestamp" }).notNull(),
  updatedAt: integer({ mode: "timestamp" }).notNull(),
  // admin plugin
  impersonatedBy: text(),
});

export const account = sqliteTable("account", {
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text().notNull(),
  providerId: text().notNull(),
  accessToken: text(),
  refreshToken: text(),
  accessTokenExpiresAt: integer({ mode: "timestamp" }),
  refreshTokenExpiresAt: integer({ mode: "timestamp" }),
  scope: text(),
  idToken: text(),
  password: text(),
  createdAt: integer({ mode: "timestamp" }).notNull(),
  updatedAt: integer({ mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: integer({ mode: "timestamp" }).notNull(),
  createdAt: integer({ mode: "timestamp" }),
  updatedAt: integer({ mode: "timestamp" }),
});

// --- App tables ---

export const guestbookEntries = sqliteTable("guestbook_entries", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  message: text().notNull(),
  createdAt: text().notNull().default(sql`(current_timestamp)`),
});

export const uploadedFiles = sqliteTable("uploaded_files", {
  id: integer().primaryKey({ autoIncrement: true }),
  filename: text().notNull(),
  r2Key: text("r2_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer().notNull(),
  createdAt: text().notNull().default(sql`(current_timestamp)`),
});
