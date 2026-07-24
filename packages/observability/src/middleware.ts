import { createLogger } from "@repo/logger";
import { createMiddleware } from "@tanstack/react-start";

const log = createLogger({ bindings: { component: "server-fn" } });

/**
 * TanStack Start middleware that logs server function execution.
 *
 * Emits structured JSON via console (captured as OTel logs by
 * Cloudflare Workers native observability). Logs start, duration,
 * and success/error status for every server function call, tagged with the
 * server function's name and source file so slow/failing functions are
 * identifiable.
 *
 * Usage:
 *   const myFn = createServerFn({ method: 'GET' })
 *     .middleware([tracingMiddleware])
 *     .handler(async () => { ... })
 */
export const tracingMiddleware = createMiddleware().server(
  async ({ next, context, serverFnMeta }) => {
    const requestId = crypto.randomUUID();
    const fn = { fnName: serverFnMeta?.name ?? "unknown", fnFile: serverFnMeta?.filename };
    const start = performance.now();

    log.info({ requestId, ...fn }, "server_fn_start");

    try {
      const ctx = (context ?? {}) as Record<string, unknown>;
      const result = await next({
        context: { ...ctx, requestId },
      });

      log.info(
        {
          requestId,
          ...fn,
          duration_ms: Math.round((performance.now() - start) * 100) / 100,
          status: "ok",
        },
        "server_fn_end",
      );

      return result;
    } catch (error) {
      log.error(
        {
          requestId,
          ...fn,
          duration_ms: Math.round((performance.now() - start) * 100) / 100,
          status: "error",
          err: error instanceof Error ? error : new Error(String(error)),
        },
        "server_fn_end",
      );
      throw error;
    }
  },
);
