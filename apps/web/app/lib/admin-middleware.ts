import { createMiddleware } from "@tanstack/react-start";

/**
 * TanStack Start middleware that restricts access to admin-only server functions.
 *
 * Verifies the caller has a valid session with `role === "admin"` and passes
 * the session into handler context so handlers can access `context.session`.
 *
 * Usage:
 * ```ts
 * const myFn = createServerFn({ method: 'POST' })
 *   .middleware([adminMiddleware])
 *   .handler(async ({ context }) => {
 *     const userId = context.session.user.id;
 *   })
 * ```
 */
export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const { env } = await import("cloudflare:workers");
  const { createAuth } = await import("~/lib/auth-server");
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const auth = createAuth(env);
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session || (session.user as Record<string, unknown>).role !== "admin") {
    throw new Error("Unauthorized");
  }

  return next({ context: { session } });
});
