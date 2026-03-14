import { drizzle } from "drizzle-orm/d1";
import { guestbookEntries } from "./schema";

const sampleEntries = [
  { name: "Alice", message: "Welcome to the guestbook! This template is great." },
  { name: "Bob", message: "Love the Cloudflare + TanStack combo." },
  { name: "Charlie", message: "Drizzle ORM makes D1 a breeze." },
  { name: "Diana", message: "The shadcn/ui components look fantastic." },
  { name: "Eve", message: "Monorepo setup with turborepo is super clean." },
];

export async function seed(d1: D1Database) {
  const db = drizzle(d1);

  console.log("Seeding guestbook entries...");
  await db.insert(guestbookEntries).values(sampleEntries);

  console.log("Seed complete.");
}
