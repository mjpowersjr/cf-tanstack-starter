import { describe, expect, it, vi } from "vitest";
import { createMockContext } from "../test-helpers";
import { healthCheck } from "./health-check";

describe("health-check job", () => {
  it("has correct metadata", () => {
    expect(healthCheck.name).toBe("health-check");
    expect(healthCheck.cron).toBe("*/15 * * * *");
  });

  it("returns healthy when all checks pass", async () => {
    const ctx = createMockContext();
    const { result, metrics } = await healthCheck.handler(ctx);

    expect(result.healthy).toBe(true);
    expect((result.checks as Record<string, unknown>).d1).toBe("ok");
    expect((result.checks as Record<string, unknown>).r2).toBe("ok");
    expect(metrics.healthy).toBe(1);
  });

  it("returns unhealthy when D1 fails", async () => {
    const ctx = createMockContext();
    (ctx.db as unknown as Record<string, unknown>).get = vi
      .fn()
      .mockRejectedValue(new Error("D1 down"));

    const { result, metrics } = await healthCheck.handler(ctx);

    expect(result.healthy).toBe(false);
    expect((result.checks as Record<string, unknown>).d1).toBe("error");
    expect(metrics.healthy).toBe(0);
    expect(ctx.log.error).toHaveBeenCalledWith("D1 health check failed", expect.any(Object));
  });

  it("returns unhealthy when R2 fails", async () => {
    const ctx = createMockContext();
    (ctx.env.BUCKET.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("R2 down"));

    const { result } = await healthCheck.handler(ctx);

    expect(result.healthy).toBe(false);
    expect((result.checks as Record<string, unknown>).r2).toBe("error");
    expect(ctx.log.error).toHaveBeenCalledWith("R2 health check failed", expect.any(Object));
  });

  it("reports user count", async () => {
    const ctx = createMockContext();
    (ctx.db as unknown as Record<string, unknown>).select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([{ count: 42 }]),
    });

    const { result, metrics } = await healthCheck.handler(ctx);

    expect((result.checks as Record<string, unknown>).userCount).toBe(42);
    expect(metrics.userCount).toBe(42);
  });
});
