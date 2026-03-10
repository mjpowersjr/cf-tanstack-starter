import { createMiddleware } from "@tanstack/react-start";
import { createLogger } from "@repo/logger";

const log = createLogger({ bindings: { component: "server-fn" } });

/**
 * TanStack Start middleware that traces server function execution.
 *
 * Automatically logs:
 * - Function ID and method
 * - Execution duration
 * - Success/error status
 * - W3C-compatible trace context
 *
 * Usage:
 * ```ts
 * const myFn = createServerFn({ method: 'GET' })
 *   .middleware([tracingMiddleware])
 *   .handler(async () => { ... })
 * ```
 */
export const tracingMiddleware = createMiddleware().server(
  async ({ next, context }) => {
    const traceId = crypto.randomUUID();
    const start = performance.now();

    log.info("server_fn_start", { traceId });

    try {
      const result = await next({ context: { ...context, traceId } });

      log.info("server_fn_end", {
        traceId,
        duration_ms: Math.round((performance.now() - start) * 100) / 100,
        status: "ok",
      });

      return result;
    } catch (error) {
      log.error("server_fn_end", {
        traceId,
        duration_ms: Math.round((performance.now() - start) * 100) / 100,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
