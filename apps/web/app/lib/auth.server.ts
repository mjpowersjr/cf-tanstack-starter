import * as schema from "@repo/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";

export function createAuth(env: {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  SIGNUP_ENABLED?: string;
}) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    plugins: [
      username(),
      admin({ defaultRole: "user" }),
      tanstackStartCookies(), // MUST be last
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Block signup if disabled (unless first user)
            if (env.SIGNUP_ENABLED === "false") {
              const { count } = await import("drizzle-orm");
              const result = await db.select({ c: count() }).from(schema.user);
              if (result[0].c > 0) {
                throw new Error("Signup is currently disabled");
              }
            }
            return user;
          },
          after: async (user) => {
            // First user becomes admin
            const { count, eq } = await import("drizzle-orm");
            const result = await db.select({ c: count() }).from(schema.user);
            if (result[0].c === 1) {
              await db
                .update(schema.user)
                .set({ role: "admin" })
                .where(eq(schema.user.id, user.id));
            }
          },
        },
      },
    },
  });
}
