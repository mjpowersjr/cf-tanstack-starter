import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientIp, rateLimitResponse } from "./rate-limit";

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    put: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    _store: store,
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

describe("checkRateLimit", () => {
  it("allows requests within limit", async () => {
    const kv = createMockKV();
    const result = await checkRateLimit(kv, "test", 5, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("tracks count across calls", async () => {
    const kv = createMockKV();

    await checkRateLimit(kv, "test", 3, 60);
    await checkRateLimit(kv, "test", 3, 60);
    const result = await checkRateLimit(kv, "test", 3, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("denies requests over limit", async () => {
    const kv = createMockKV();

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(kv, "test", 3, 60);
    }

    const result = await checkRateLimit(kv, "test", 3, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const kv = createMockKV();
    const now = Math.floor(Date.now() / 1000);

    // Simulate an expired window entry
    kv._store.set("rl:test", JSON.stringify({ count: 10, windowStart: now - 120 }));

    const result = await checkRateLimit(kv, "test", 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("handles corrupted KV data gracefully", async () => {
    const kv = createMockKV();
    kv._store.set("rl:test", "not-json");

    const result = await checkRateLimit(kv, "test", 5, 60);
    expect(result.allowed).toBe(true);
  });

  it("isolates different keys", async () => {
    const kv = createMockKV();

    await checkRateLimit(kv, "key-a", 1, 60);
    const result = await checkRateLimit(kv, "key-b", 1, 60);

    expect(result.allowed).toBe(true);
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with Retry-After header", () => {
    const futureReset = Math.floor(Date.now() / 1000) + 30;
    const response = rateLimitResponse(futureReset);

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("getClientIp", () => {
  it("extracts cf-connecting-ip", () => {
    const req = new Request("http://test.com", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-forwarded-for", () => {
    const req = new Request("http://test.com", {
      headers: { "x-forwarded-for": "5.6.7.8, 9.10.11.12" },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("returns unknown when no headers", () => {
    const req = new Request("http://test.com");
    expect(getClientIp(req)).toBe("unknown");
  });
});
