import { defineConfig } from "drizzle-kit";

// drizzle-kit is used for `db:generate` (schema → migration SQL) only.
// Migration application is handled by our own runner at `scripts/migrate.ts`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
