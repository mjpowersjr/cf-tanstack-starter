// Server-only: better-auth config with DB + secrets. The marker makes any
// accidental client import a build error with a full import trace.
import "@tanstack/react-start/server-only";

import * as schema from "@repo/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";

export function createAuth(env: Cloudflare.Env) {
  if (!env.BETTER_AUTH_SECRET) {
    // Without a secret better-auth can fall back to a publicly-known default,
    // making every session token forgeable. Fail hard instead.
    throw new Error(
      "BETTER_AUTH_SECRET is not set — run `wrangler secret put BETTER_AUTH_SECRET` (or add it to apps/web/.dev.vars for local dev).",
    );
  }

  const db = drizzle(env.DB, { schema });

  const adminEmails = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    user: {
      // Let users delete their own account from settings. Credential users
      // must re-enter their password (verified by better-auth); the session
      // is destroyed on success. No email verification step is wired — add a
      // `sendDeleteAccountVerification` callback here if you want one.
      deleteUser: { enabled: true },
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        const { sendEmail } = await import("~/lib/email");
        const safeName = user.name.replace(/[&<>"']/g, (c) => {
          const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          };
          return entities[c] ?? c;
        });
        await sendEmail(env, {
          to: user.email,
          subject: "Reset your password",
          html: `<p>Hi ${safeName},</p><p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
        });
      },
    },
    plugins: [
      username(),
      admin({ defaultRole: "user" }),
      tanstackStartCookies(), // MUST be last
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            const isAdminEmail = adminEmails.includes((user.email ?? "").toLowerCase());
            // SIGNUP_ENABLED only gates self-service signup — admin-created
            // users (/admin/create-user) and ADMIN_EMAILS bootstrap accounts
            // are exempt, so operators can disable public registration
            // without locking themselves out.
            const isSelfSignup = ctx?.path?.startsWith("/sign-up") ?? false;
            if (isSelfSignup && env.SIGNUP_ENABLED === "false" && !isAdminEmail) {
              throw new Error("Signup is currently disabled");
            }
            // Accounts listed in ADMIN_EMAILS are promoted at creation. This
            // replaces "first registrant becomes admin", which handed the
            // site to whoever found a fresh deployment first (and raced under
            // concurrent signups).
            if (isAdminEmail) {
              return { data: { ...user, role: "admin" } };
            }
            return { data: user };
          },
        },
      },
    },
  });
}
