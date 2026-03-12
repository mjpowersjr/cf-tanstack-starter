/**
 * Generates seed SQL for the local D1 database.
 *
 * Creates:
 * - An admin user (admin / admin@example.com / password)
 * - A regular user (user / user@example.com / password)
 * - Sample guestbook entries
 * - Sample uploaded_files metadata rows
 *
 * Run via: pnpm --filter @repo/db db:seed:generate
 * Then apply: pnpm --filter @repo/db db:seed:apply
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "better-auth/crypto";

const now = Math.floor(Date.now() / 1000);

function esc(str: string): string {
  return str.replace(/'/g, "''");
}

async function main() {
  const statements: string[] = [];

  // --- Admin user ---
  const adminId = crypto.randomUUID();
  const adminAccountId = crypto.randomUUID();
  const adminHash = await hashPassword("password");

  statements.push(
    `INSERT OR IGNORE INTO user (id, name, email, email_verified, username, display_username, role, banned, created_at, updated_at) VALUES ('${adminId}', 'Admin', 'admin@example.com', 0, 'admin', 'Admin', 'admin', 0, ${now}, ${now});`,
  );
  statements.push(
    `INSERT OR IGNORE INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at) VALUES ('${adminAccountId}', '${adminId}', '${adminId}', 'credential', '${esc(adminHash)}', ${now}, ${now});`,
  );

  // --- Regular user ---
  const userId = crypto.randomUUID();
  const userAccountId = crypto.randomUUID();
  const userHash = await hashPassword("password");

  statements.push(
    `INSERT OR IGNORE INTO user (id, name, email, email_verified, username, display_username, role, banned, created_at, updated_at) VALUES ('${userId}', 'User', 'user@example.com', 0, 'user', 'User', 'user', 0, ${now}, ${now});`,
  );
  statements.push(
    `INSERT OR IGNORE INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at) VALUES ('${userAccountId}', '${userId}', '${userId}', 'credential', '${esc(userHash)}', ${now}, ${now});`,
  );

  // --- Guestbook entries ---
  const sampleEntries = [
    { name: "Alice", message: "Welcome to the guestbook! This template is great." },
    { name: "Bob", message: "Love the Cloudflare + TanStack combo." },
    { name: "Charlie", message: "Drizzle ORM makes D1 a breeze." },
    { name: "Diana", message: "The shadcn/ui components look fantastic." },
    { name: "Eve", message: "Monorepo setup with turborepo is super clean." },
  ];

  for (const entry of sampleEntries) {
    statements.push(
      `INSERT INTO guestbook_entries (name, message) VALUES ('${esc(entry.name)}', '${esc(entry.message)}');`,
    );
  }

  // --- Uploaded files metadata (no actual R2 objects) ---
  const sampleFiles = [
    {
      filename: "readme.txt",
      r2Key: "uploads/seed-readme.txt",
      contentType: "text/plain",
      size: 256,
    },
    { filename: "logo.png", r2Key: "uploads/seed-logo.png", contentType: "image/png", size: 4096 },
  ];

  for (const file of sampleFiles) {
    statements.push(
      `INSERT INTO uploaded_files (filename, r2_key, content_type, size) VALUES ('${esc(file.filename)}', '${esc(file.r2Key)}', '${esc(file.contentType)}', ${file.size});`,
    );
  }

  const outPath = join(import.meta.dirname, "..", "seed.sql");
  writeFileSync(outPath, `${statements.join("\n")}\n`);
  console.log(`Wrote seed SQL to ${outPath}`);
  console.log("");
  console.log("Seed users:");
  console.log("  admin / admin@example.com / password  (role: admin)");
  console.log("  user  / user@example.com  / password  (role: user)");
  console.log("");
  console.log("Apply with: pnpm db:seed  (or: pnpm --filter @repo/web db:seed)");
}

main();
