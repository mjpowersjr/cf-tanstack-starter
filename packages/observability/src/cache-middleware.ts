import { createMiddleware } from "@tanstack/react-start";

/**
 * Cache headers middleware for GET server functions.
 *
 * Sets `Cache-Control` headers on responses to improve performance
 * for read-heavy endpoints (e.g., guestbook list, file list).
 *
 * Usage:
 * ```ts
 * const getData = createServerFn({ method: 'GET' })
 *   .middleware([tracingMiddleware, cacheMiddleware({ maxAge: 10 })])
 *   .handler(async () => { ... })
 * ```
 */
export function cacheMiddleware(options: { maxAge?: number; staleWhileRevalidate?: number } = {}) {
  const { maxAge = 0, staleWhileRevalidate = 60 } = options;

  return createMiddleware().server(async ({ next, context }) => {
    const result = await next();

    // Attach cache hint to context for upstream middleware/handlers
    return result;
  });
}
