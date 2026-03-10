import { drizzle } from "drizzle-orm/d1";
import { guestbookEntries, uploadedFiles } from "./schema";

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

export async function seed(d1: D1Database) {
  const db = drizzle(d1);

  console.log("Seeding guestbook entries...");
  await db.insert(guestbookEntries).values(sampleEntries);

  console.log("Seeding file metadata...");
  await db.insert(uploadedFiles).values(sampleFiles);

  console.log("Seed complete.");
}
