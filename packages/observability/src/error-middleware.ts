import { createLogger } from "@repo/logger";
import { createMiddleware } from "@tanstack/react-start";

const log = createLogger({ bindings: { component: "error-middleware" } });

/**
 * Global error middleware for server functions.
 *
 * Catches unhandled errors, logs structured error details with the
 * trace ID from context (set by tracingMiddleware), and re-throws
 * a sanitized error to the client.
 *
 * Stack with tracingMiddleware:
 * ```ts
 * .middleware([tracingMiddleware, errorMiddleware])
 * ```
 */
export const errorMiddleware = createMiddleware().server(async ({ next, context }) => {
  try {
    return await next();
  } catch (error) {
    const traceId = (context as Record<string, unknown>).traceId as string | undefined;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    log.error("unhandled_server_error", {
      ...(traceId ? { traceId } : {}),
      error: message,
      ...(stack ? { stack } : {}),
    });

    // Re-throw a sanitized error (don't leak internals to client)
    throw new Error(
      process.env.NODE_ENV === "development"
        ? message
        : "An internal error occurred. Please try again.",
    );
  }
});
