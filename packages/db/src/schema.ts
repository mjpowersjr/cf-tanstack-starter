import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const session = sqliteTable(
  "session",
  {
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
  },
  // SQLite does not auto-index FK columns; session lookups by user are hot paths.
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
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
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer({ mode: "timestamp" }).notNull(),
    createdAt: integer({ mode: "timestamp" }),
    updatedAt: integer({ mode: "timestamp" }),
  },
  // better-auth queries verification rows by identifier.
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// --- App tables ---

// App tables store timestamps as unix-epoch seconds (drizzle `timestamp` mode),
// matching the auth tables — TEXT current_timestamp has no timezone marker and
// JS parses it as local time.

export const guestbookEntries = sqliteTable("guestbook_entries", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  message: text().notNull(),
  createdAt: integer({ mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const uploadedFiles = sqliteTable(
  "uploaded_files",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    filename: text().notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer().notNull(),
    // Uploader; null for legacy/seed rows. Deletes are scoped to the owner (or admin).
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer({ mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("uploaded_files_userId_idx").on(t.userId)],
);

// --- Background Jobs ---

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    jobName: text("job_name").notNull(),
    triggerType: text("trigger_type").notNull(), // "cron" | "manual"
    triggerCron: text("trigger_cron"),
    triggeredBy: text("triggered_by"),
    status: text().notNull(), // "running" | "success" | "error"
    startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    durationMs: integer("duration_ms"),
    result: text({ mode: "json" }),
    metrics: text({ mode: "json" }),
    error: text(),
    errorStack: text("error_stack"),
    logs: text({ mode: "json" }),
  },
  // Job-history listing filters by name and orders by start time.
  (t) => [index("job_runs_jobName_startedAt_idx").on(t.jobName, t.startedAt)],
);
