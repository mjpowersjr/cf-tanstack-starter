import { createDb, jobRuns } from "@repo/db";
import { createLogger } from "@repo/logger";
import { eq } from "drizzle-orm";
import type { JobContext, JobDefinition } from "./types";

interface LogEntry {
  level: string;
  msg: string;
  ts: number;
  [key: string]: unknown;
}

const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

/** Reshape a pino entry into the {level, msg, ts} rows the admin UI renders. */
function toLogEntry(entry: Record<string, unknown>): LogEntry {
  const { level, time, msg, ...rest } = entry;
  return {
    level: LEVEL_LABELS[level as number] ?? String(level),
    msg: String(msg ?? ""),
    ts: typeof time === "number" ? time : Date.now(),
    ...rest,
  };
}

export interface ExecuteJobOptions {
  triggerType: "cron" | "manual";
  triggerCron?: string;
  triggeredBy?: string;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * A run whose isolate was evicted (or that outlived its waitUntil budget)
 * never finalizes its row and would sit in "running" forever. Any row older
 * than this is presumed dead and swept to "error".
 */
const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000;

export async function sweepStaleRuns(env: Cloudflare.Env): Promise<number> {
  const { and, lt, eq: eqOp } = await import("drizzle-orm");
  const db = createDb(env.DB);
  const cutoff = new Date(Date.now() - STALE_RUN_THRESHOLD_MS);
  const swept = await db
    .update(jobRuns)
    .set({
      status: "error",
      completedAt: new Date(),
      error: "Run never finalized (worker evicted or timed out) — swept as stale",
    })
    .where(and(eqOp(jobRuns.status, "running"), lt(jobRuns.startedAt, cutoff)))
    .returning({ id: jobRuns.id });
  return swept.length;
}

function timeoutAfter(ms: number): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Job timed out after ${ms}ms (timeoutMs cap)`)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

export async function executeJob(
  job: JobDefinition,
  env: Cloudflare.Env,
  options: ExecuteJobOptions,
): Promise<void> {
  const db = createDb(env.DB);
  const logBuffer: LogEntry[] = [];
  const log = createLogger({
    bindings: { component: "jobs", job: job.name },
    onEntry: (entry) => logBuffer.push(toLogEntry(entry)),
  });

  // Insert initial "running" row
  const [row] = await db
    .insert(jobRuns)
    .values({
      jobName: job.name,
      triggerType: options.triggerType,
      triggerCron: options.triggerCron ?? null,
      triggeredBy: options.triggeredBy ?? null,
      status: "running",
    })
    .returning({ id: jobRuns.id });

  if (!row) {
    throw new Error(`Failed to record run for job ${job.name} — aborting`);
  }
  const runId = row.id;
  const start = performance.now();

  log.info({ runId, triggerType: options.triggerType }, "Job started");

  const finalize = async (values: Partial<typeof jobRuns.$inferInsert>) => {
    try {
      await db
        .update(jobRuns)
        .set({ completedAt: new Date(), logs: logBuffer, ...values })
        .where(eq(jobRuns.id, runId));
    } catch (updateError) {
      // Never let bookkeeping failure escape executeJob — in cron dispatch
      // that's an unhandled waitUntil rejection, and in manual triggers it
      // reports a finished job as failed. The stale sweep will catch the row.
      log.error(
        { runId, err: updateError instanceof Error ? updateError : new Error(String(updateError)) },
        "Failed to finalize job run row",
      );
    }
  };

  const timeout = timeoutAfter(job.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const ctx: JobContext = {
      db,
      env,
      log,
      triggerType: options.triggerType,
      triggerCron: options.triggerCron,
      triggeredBy: options.triggeredBy,
    };

    const { result, metrics } = await Promise.race([job.handler(ctx), timeout.promise]);
    const durationMs = Math.round(performance.now() - start);

    log.info({ runId, durationMs }, "Job completed");

    await finalize({ status: "success", durationMs, result, metrics });
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    log.error({ runId, durationMs, error: errorMessage }, "Job failed");

    await finalize({
      status: "error",
      durationMs,
      error: errorMessage,
      errorStack: errorStack ?? null,
    });
  } finally {
    timeout.cancel();
  }
}
