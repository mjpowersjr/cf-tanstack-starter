/**
 * Auth guards for server.handlers routes (file-based API endpoints).
 *
 * These routes bypass createServerFn middleware, so auth must be checked manually.
 * Every file with server.handlers MUST either call a guard or be annotated with
 * `// @public` to signal intentional public access.
 *
 * Usage:
 * ```ts
 * GET: async ({ request, params }) => {
 *   const session = await requireAuth(request);
 *   if (session instanceof Response) return session;
 *   // session is valid — proceed
 * }
 * ```
 */

type Session = {
  user: { id: string; name: string; email: string; role?: string; [key: string]: unknown };
  session: { token: string; [key: string]: unknown };
};

export async function requireAuth(request: Request): Promise<Session | Response> {
  const { env } = await import("cloudflare:workers");
  const { createAuth } = await import("~/lib/auth-server");
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  return session as Session;
}

export async function requireAdmin(request: Request): Promise<Session | Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) return result;

  if ((result.user as Record<string, unknown>).role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  return result;
}
