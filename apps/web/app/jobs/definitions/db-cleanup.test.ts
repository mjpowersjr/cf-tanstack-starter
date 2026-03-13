import { describe, expect, it, vi } from "vitest";
import { createMockContext } from "../test-helpers";
import { dbCleanup } from "./db-cleanup";

describe("db-cleanup job", () => {
  it("has correct metadata", () => {
    expect(dbCleanup.name).toBe("db-cleanup");
    expect(dbCleanup.cron).toBe("0 * * * *");
  });

  it("returns deletion counts when no expired records", async () => {
    const ctx = createMockContext();
    const { result, metrics } = await dbCleanup.handler(ctx);

    expect(result.expiredSessions).toBe(0);
    expect(result.expiredVerifications).toBe(0);
    expect(metrics.sessionsDeleted).toBe(0);
    expect(metrics.verificationsDeleted).toBe(0);
  });

  it("returns deletion counts when expired records exist", async () => {
    const mockReturning = vi.fn();

    // First call: sessions delete
    mockReturning.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }]);
    // Second call: verifications delete
    mockReturning.mockResolvedValueOnce([{ id: "v1" }]);

    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

    const ctx = createMockContext();
    (ctx.db as unknown as Record<string, unknown>).delete = mockDelete;

    const { result, metrics } = await dbCleanup.handler(ctx);

    expect(result.expiredSessions).toBe(2);
    expect(result.expiredVerifications).toBe(1);
    expect(metrics.sessionsDeleted).toBe(2);
    expect(metrics.verificationsDeleted).toBe(1);
  });

  it("logs cleanup progress", async () => {
    const ctx = createMockContext();
    await dbCleanup.handler(ctx);

    expect(ctx.log.info).toHaveBeenCalledWith("Starting cleanup", expect.any(Object));
    expect(ctx.log.info).toHaveBeenCalledWith("Deleted expired sessions", { count: 0 });
    expect(ctx.log.info).toHaveBeenCalledWith("Deleted expired verifications", { count: 0 });
  });
});
