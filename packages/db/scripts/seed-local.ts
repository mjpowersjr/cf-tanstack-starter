/**
 * Generates seed SQL for the local D1 database.
 *
 * Run via: pnpm --filter @repo/db db:seed
 */

const sampleEntries = [
  { name: "Alice", message: "Welcome to the guestbook! This template is great." },
  { name: "Bob", message: "Love the Cloudflare + TanStack combo." },
  { name: "Charlie", message: "Drizzle ORM makes D1 a breeze." },
  { name: "Diana", message: "The shadcn/ui components look fantastic." },
  { name: "Eve", message: "Monorepo setup with turborepo is super clean." },
];

const sampleFiles = [
  {
    filename: "readme.txt",
    r2Key: "uploads/seed-readme.txt",
    contentType: "text/plain",
    size: 256,
  },
  {
    filename: "logo.png",
    r2Key: "uploads/seed-logo.png",
    contentType: "image/png",
    size: 4096,
  },
];

function esc(str: string): string {
  return str.replace(/'/g, "''");
}

const statements: string[] = [];

for (const entry of sampleEntries) {
  statements.push(
    `INSERT INTO guestbook_entries (name, message) VALUES ('${esc(entry.name)}', '${esc(entry.message)}');`,
  );
}

for (const file of sampleFiles) {
  statements.push(
    `INSERT INTO uploaded_files (filename, r2_key, content_type, size) VALUES ('${esc(file.filename)}', '${esc(file.r2Key)}', '${esc(file.contentType)}', ${file.size});`,
  );
}

// Write to a temp file for wrangler d1 execute --file
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const outPath = join(import.meta.dirname, "..", "seed.sql");
writeFileSync(outPath, `${statements.join("\n")}\n`);
console.log(`Wrote seed SQL to ${outPath}`);
