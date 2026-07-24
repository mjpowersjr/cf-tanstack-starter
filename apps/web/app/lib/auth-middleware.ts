import { createMiddleware } from "@tanstack/react-start";

/**
 * TanStack Start middleware that requires any valid session (not admin).
 *
 * Passes the session into handler context so handlers can access
 * `context.session`.
 *
 * Usage:
 * ```ts
 * const myFn = createServerFn({ method: 'POST' })
 *   .middleware([authMiddleware])
 *   .handler(async ({ context }) => {
 *     const userId = context.session.user.id;
 *   })
 * ```
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const { env } = await import("cloudflare:workers");
  const { createAuth } = await import("~/lib/auth-server");
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });

  if (!session) {
    throw new Error("Unauthorized — sign in required");
  }

  return next({ context: { session } });
});
