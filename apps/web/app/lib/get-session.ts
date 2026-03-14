import { tracingMiddleware } from "@repo/observability/middleware";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

export const getSession = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .handler(async () => {
    const { env } = await import("cloudflare:workers");
    const { createAuth } = await import("~/lib/auth.server");
    const auth = createAuth(env);
    const headers = getRequestHeaders();
    return await auth.api.getSession({ headers });
  });
