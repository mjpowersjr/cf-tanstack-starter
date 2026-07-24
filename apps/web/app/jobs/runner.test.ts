import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDefinition } from "./types";

const state = {
  insertedRows: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  returningRows: [{ id: 7 }] as { id: number }[],
  updateShouldThrow: false,
};

vi.mock("@repo/db", () => ({
  createDb: () => ({
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          state.insertedRows.push(row);
          return state.returningRows;
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        // Drizzle's builder is both awaitable and chainable with .returning().
        where: () => {
          const exec = async () => {
            if (state.updateShouldThrow) throw new Error("D1 unavailable");
            state.updates.push(values);
            return [] as { id: number }[];
          };
          return {
            returning: () => exec(),
            // biome-ignore lint/suspicious/noThenProperty: mimicking drizzle's thenable builder
            then: (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
              exec().then(onFulfilled, onRejected),
          };
        },
      }),
    }),
  }),
  jobRuns: { id: {}, status: {}, startedAt: {} },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  lt: vi.fn(),
}));

import { executeJob, sweepStaleRuns } from "./runner";

const env = {} as Cloudflare.Env;

function makeJob(overrides: Partial<JobDefinition>): JobDefinition {
  return {
    name: "test-job",
    description: "test",
    cron: null,
    handler: async () => ({ result: { ok: true }, metrics: { n: 1 } }),
    ...overrides,
  };
}

beforeEach(() => {
  state.insertedRows = [];
  state.updates = [];
  state.returningRows = [{ id: 7 }];
  state.updateShouldThrow = false;
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("executeJob", () => {
  it("records a running row, then finalizes with success + result + metrics", async () => {
    await executeJob(makeJob({}), env, { triggerType: "manual", triggeredBy: "u1" });

    expect(state.insertedRows[0]).toMatchObject({
      jobName: "test-job",
      triggerType: "manual",
      triggeredBy: "u1",
      status: "running",
    });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({
      status: "success",
      result: { ok: true },
      metrics: { n: 1 },
    });
    expect(state.updates[0].completedAt).toBeInstanceOf(Date);
    expect(state.updates[0].durationMs).toBeTypeOf("number");
  });

  it("captures handler errors with message and stack", async () => {
    const job = makeJob({
      handler: async () => {
        throw new Error("boom");
      },
    });

    await executeJob(job, env, { triggerType: "cron", triggerCron: "0 * * * *" });

    expect(state.updates[0]).toMatchObject({ status: "error", error: "boom" });
    expect(state.updates[0].errorStack).toContain("boom");
  });

  it("buffers the job's structured logs into the run row", async () => {
    const job = makeJob({
      handler: async (ctx) => {
        ctx.log.info({ step: 1 }, "doing work");
        return { result: {}, metrics: {} };
      },
    });

    await executeJob(job, env, { triggerType: "manual" });

    const logs = state.updates[0].logs as { level: string; msg: string; step?: number }[];
    const entry = logs.find((l) => l.msg === "doing work");
    expect(entry).toMatchObject({ level: "info", step: 1 });
  });

  it("records an error when the handler exceeds timeoutMs", async () => {
    const job = makeJob({
      timeoutMs: 20,
      handler: () => new Promise(() => {}), // never resolves
    });

    await executeJob(job, env, { triggerType: "manual" });

    expect(state.updates[0].status).toBe("error");
    expect(String(state.updates[0].error)).toContain("timed out");
  });

  it("throws when the run row cannot be recorded", async () => {
    state.returningRows = [];
    await expect(executeJob(makeJob({}), env, { triggerType: "manual" })).rejects.toThrow(
      /Failed to record run/,
    );
  });

  it("swallows finalize failures instead of rejecting (waitUntil safety)", async () => {
    state.updateShouldThrow = true;
    await expect(executeJob(makeJob({}), env, { triggerType: "manual" })).resolves.toBeUndefined();
  });
});

describe("sweepStaleRuns", () => {
  it("marks stale running rows as error and returns the count", async () => {
    const swept = await sweepStaleRuns(env);
    expect(swept).toBe(0);
    expect(state.updates[0]).toMatchObject({ status: "error" });
    expect(String(state.updates[0].error)).toContain("stale");
  });
});
