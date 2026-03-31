import { defineConfig } from "drizzle-kit";

// When CLOUDFLARE_DATABASE_ID is set, use d1-http driver for remote migrations.
// Otherwise, use plain sqlite dialect for schema generation only.
const isRemote = !!process.env.CLOUDFLARE_DATABASE_ID;

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
  ...(isRemote && {
    driver: "d1-http",
    dbCredentials: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
      token: process.env.CLOUDFLARE_D1_TOKEN!,
    },
  }),
});
