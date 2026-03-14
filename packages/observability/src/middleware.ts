import { createLogger } from "@repo/logger";
import { createMiddleware } from "@tanstack/react-start";

const log = createLogger({ bindings: { component: "server-fn" } });

/**
 * TanStack Start middleware that logs server function execution.
 *
 * Emits structured JSON via console (captured as OTel logs by
 * Cloudflare Workers native observability). Logs start, duration,
 * and success/error status for every server function call.
 *
 * Usage:
 *   const myFn = createServerFn({ method: 'GET' })
 *     .middleware([tracingMiddleware])
 *     .handler(async () => { ... })
 */
export const tracingMiddleware = createMiddleware().server(async ({ next, context }) => {
  const requestId = crypto.randomUUID();
  const start = performance.now();

  log.info("server_fn_start", { requestId });

  try {
    const ctx = (context ?? {}) as Record<string, unknown>;
    const result = await next({
      context: { ...ctx, requestId },
    });

    log.info("server_fn_end", {
      requestId,
      duration_ms: Math.round((performance.now() - start) * 100) / 100,
      status: "ok",
    });

    return result;
  } catch (error) {
    log.error("server_fn_end", {
      requestId,
      duration_ms: Math.round((performance.now() - start) * 100) / 100,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
