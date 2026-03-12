import { createLogger } from "@repo/logger";

const log = createLogger({ bindings: { component: "rate-limit" } });

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * KV-backed sliding window rate limiter for Cloudflare Workers.
 *
 * Stores a counter + window start timestamp per key. When the window expires,
 * the counter resets. This is a fixed-window approach (simpler than true
 * sliding window, but sufficient for abuse prevention).
 *
 * KV key format: `rl:<key>`
 * KV value: JSON `{ count: number, windowStart: number }`
 * KV TTL: matches windowSecs (auto-cleanup)
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSecs: number,
): Promise<RateLimitResult> {
  const kvKey = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);

  const raw = await kv.get(kvKey);
  let count = 0;
  let windowStart = now;

  if (raw) {
    try {
      const data = JSON.parse(raw) as { count: number; windowStart: number };
      if (now - data.windowStart < windowSecs) {
        count = data.count;
        windowStart = data.windowStart;
      }
    } catch {
      // Corrupted entry — treat as fresh window
    }
  }

  count++;
  const resetAt = windowStart + windowSecs;
  const allowed = count <= limit;

  // Always write back — even if denied, so we track continued attempts
  await kv.put(kvKey, JSON.stringify({ count, windowStart }), {
    expirationTtl: windowSecs,
  });

  if (!allowed) {
    log.warn("Rate limit exceeded", { key, count, limit, windowSecs });
  }

  return { allowed, remaining: Math.max(0, limit - count), resetAt };
}

/**
 * Returns a 429 Response with standard rate limit headers.
 */
export function rateLimitResponse(resetAt: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(0, resetAt - Math.floor(Date.now() / 1000))),
    },
  });
}

/**
 * Extract a client identifier from a Request for rate limiting.
 * Uses CF-Connecting-IP (set by Cloudflare) with a fallback.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
