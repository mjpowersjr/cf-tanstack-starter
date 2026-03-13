import { vi } from "vitest";
import type { JobContext } from "./types";

/**
 * Creates a mock JobContext for testing job handlers.
 * All db methods return empty arrays by default.
 */
export function createMockContext(overrides?: Partial<JobContext>): JobContext {
  const mockDb = {
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([{ count: 0 }]),
    }),
    get: vi.fn().mockResolvedValue({ ok: 1 }),
  };

  const mockLog = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "info" as const,
  };

  const mockEnv = {
    DB: {} as D1Database,
    BUCKET: {
      list: vi.fn().mockResolvedValue({ objects: [] }),
    } as unknown as R2Bucket,
    RATE_LIMIT: {} as KVNamespace,
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:5173",
    SIGNUP_ENABLED: "true",
  };

  return {
    db: mockDb as unknown as JobContext["db"],
    env: mockEnv as unknown as Cloudflare.Env,
    log: mockLog,
    triggerType: "manual",
    ...overrides,
  };
}
