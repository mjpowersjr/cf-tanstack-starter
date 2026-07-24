import { createMiddleware } from "@tanstack/react-start";
import { checkRateLimit, rateLimitResponse } from "./rate-limit";

/**
 * Creates a TanStack Start middleware that enforces per-IP rate limits
 * using the Cloudflare KV namespace bound as RATE_LIMIT.
 *
 * Usage:
 * ```ts
 * const myFn = createServerFn({ method: 'POST' })
 *   .middleware([rateLimitMiddleware({ key: "add-entry", limit: 30, windowSecs: 60 })])
 *   .handler(async () => { ... })
 * ```
 */
export function rateLimitMiddleware(opts: { key: string; limit: number; windowSecs: number }) {
  return createMiddleware().server(async ({ next }) => {
    const { env } = await import("cloudflare:workers");
    const { getRequestHeaders } = await import("@tanstack/react-start/server");

    const headers = getRequestHeaders();
    // Trust only cf-connecting-ip (always set by Cloudflare in production);
    // other forwarding headers are client-controlled.
    const ip = headers.get("cf-connecting-ip") || "unknown";

    const result = await checkRateLimit(
      (env as Cloudflare.Env).RATE_LIMIT,
      `${opts.key}:${ip}`,
      opts.limit,
      opts.windowSecs,
    );

    if (!result.allowed) {
      // A thrown Response is returned as-is by TanStack Start — clients get a
      // real 429 with Retry-After instead of an opaque 500.
      throw rateLimitResponse(result.resetAt);
    }

    return next();
  });
}
