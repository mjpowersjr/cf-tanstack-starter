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
    // Third call: job-run history prune
    mockReturning.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

    const ctx = createMockContext();
    (ctx.db as unknown as Record<string, unknown>).delete = mockDelete;

    const { result, metrics } = await dbCleanup.handler(ctx);

    expect(result.expiredSessions).toBe(2);
    expect(result.expiredVerifications).toBe(1);
    expect(result.prunedJobRuns).toBe(3);
    expect(metrics.sessionsDeleted).toBe(2);
    expect(metrics.verificationsDeleted).toBe(1);
    expect(metrics.jobRunsPruned).toBe(3);
  });

  it("logs cleanup progress", async () => {
    const ctx = createMockContext();
    await dbCleanup.handler(ctx);

    expect(ctx.log.info).toHaveBeenCalledWith(expect.any(Object), "Starting cleanup");
    expect(ctx.log.info).toHaveBeenCalledWith({ count: 0 }, "Deleted expired sessions");
    expect(ctx.log.info).toHaveBeenCalledWith({ count: 0 }, "Deleted expired verifications");
  });
});
