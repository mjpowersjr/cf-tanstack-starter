import { createDb, jobRuns } from "@repo/db";
import { createLogger, type Logger, type LogLevel } from "@repo/logger";
import { eq } from "drizzle-orm";
import type { JobContext, JobDefinition } from "./types";

interface LogEntry {
  level: string;
  msg: string;
  ts: number;
  [key: string]: unknown;
}

function createBufferedLogger(base: Logger, buffer: LogEntry[]): Logger {
  const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];
  const logger = { ...base };

  for (const level of levels) {
    const original = base[level].bind(base);
    logger[level] = ((...args: [unknown, unknown?]) => {
      // Extract msg and extra like the base logger does
      let msg: string;
      let extra: Record<string, unknown> | undefined;
      if (typeof args[0] === "string") {
        msg = args[0];
        extra = args[1] as Record<string, unknown> | undefined;
      } else {
        extra = args[0] as Record<string, unknown>;
        msg = args[1] as string;
      }
      buffer.push({ level, msg, ts: Date.now(), ...extra });
      // Call original with the same args
      (original as (...a: unknown[]) => void)(...args);
    }) as Logger[typeof level];
  }

  logger.child = (bindings: Record<string, unknown>) => {
    return createBufferedLogger(base.child(bindings), buffer);
  };

  return logger;
}

export interface ExecuteJobOptions {
  triggerType: "cron" | "manual";
  triggerCron?: string;
  triggeredBy?: string;
}

export async function executeJob(
  job: JobDefinition,
  env: Cloudflare.Env,
  options: ExecuteJobOptions,
): Promise<void> {
  const db = createDb(env.DB);
  const logBuffer: LogEntry[] = [];
  const baseLogger = createLogger({ bindings: { component: "jobs", job: job.name } });
  const log = createBufferedLogger(baseLogger, logBuffer);

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

  const runId = row.id;
  const start = performance.now();

  log.info("Job started", { runId, triggerType: options.triggerType });

  try {
    const ctx: JobContext = {
      db,
      env,
      log,
      triggerType: options.triggerType,
      triggerCron: options.triggerCron,
      triggeredBy: options.triggeredBy,
    };

    const { result, metrics } = await job.handler(ctx);
    const durationMs = Math.round(performance.now() - start);

    log.info("Job completed", { runId, durationMs });

    await db
      .update(jobRuns)
      .set({
        status: "success",
        completedAt: new Date().toISOString(),
        durationMs,
        result,
        metrics,
        logs: logBuffer,
      })
      .where(eq(jobRuns.id, runId));
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    log.error("Job failed", { runId, durationMs, error: errorMessage });

    await db
      .update(jobRuns)
      .set({
        status: "error",
        completedAt: new Date().toISOString(),
        durationMs,
        error: errorMessage,
        errorStack: errorStack ?? null,
        logs: logBuffer,
      })
      .where(eq(jobRuns.id, runId));
  }
}
