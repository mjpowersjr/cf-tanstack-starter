import { jobRuns, session, verification } from "@repo/db";
import { and, lt, ne, sql } from "drizzle-orm";
import type { JobDefinition } from "../types";

/** Completed job-run history older than this is pruned. */
const JOB_RUN_RETENTION_DAYS = 30;

export const dbCleanup: JobDefinition = {
  name: "db-cleanup",
  description: "Delete expired sessions, verification records, and old job-run history",
  cron: "0 * * * *",
  handler: async (ctx) => {
    const now = Math.floor(Date.now() / 1000);

    ctx.log.info({ now }, "Starting cleanup");

    const expiredSessions = await ctx.db
      .delete(session)
      .where(lt(session.expiresAt, sql`${now}`))
      .returning({ id: session.id });

    ctx.log.info({ count: expiredSessions.length }, "Deleted expired sessions");

    const expiredVerifications = await ctx.db
      .delete(verification)
      .where(lt(verification.expiresAt, sql`${now}`))
      .returning({ id: verification.id });

    ctx.log.info({ count: expiredVerifications.length }, "Deleted expired verifications");

    // The health-check job alone writes ~96 rows/day — without retention the
    // table grows unbounded. Keep in-flight rows for the stale sweep.
    const cutoff = new Date(Date.now() - JOB_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const prunedRuns = await ctx.db
      .delete(jobRuns)
      .where(and(lt(jobRuns.startedAt, cutoff), ne(jobRuns.status, "running")))
      .returning({ id: jobRuns.id });

    ctx.log.info({ count: prunedRuns.length }, "Pruned old job runs");

    return {
      result: {
        expiredSessions: expiredSessions.length,
        expiredVerifications: expiredVerifications.length,
        prunedJobRuns: prunedRuns.length,
      },
      metrics: {
        sessionsDeleted: expiredSessions.length,
        verificationsDeleted: expiredVerifications.length,
        jobRunsPruned: prunedRuns.length,
      },
    };
  },
};
