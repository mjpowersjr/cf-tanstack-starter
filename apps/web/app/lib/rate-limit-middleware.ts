import { createMiddleware } from "@tanstack/react-start";
import { checkRateLimit } from "./rate-limit";

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
    const ip =
      headers["cf-connecting-ip"] ||
      (headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      "unknown";

    const result = await checkRateLimit(
      (env as Cloudflare.Env).RATE_LIMIT,
      `${opts.key}:${ip}`,
      opts.limit,
      opts.windowSecs,
    );

    if (!result.allowed) {
      throw new Error("Too many requests");
    }

    return next();
  });
}
