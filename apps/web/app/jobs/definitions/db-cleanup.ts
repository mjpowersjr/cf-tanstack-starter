import { session, verification } from "@repo/db";
import { lt, sql } from "drizzle-orm";
import type { JobDefinition } from "../types";

export const dbCleanup: JobDefinition = {
  name: "db-cleanup",
  description: "Delete expired sessions and verification records",
  cron: "0 * * * *",
  handler: async (ctx) => {
    const now = Math.floor(Date.now() / 1000);

    ctx.log.info("Starting cleanup", { now });

    const expiredSessions = await ctx.db
      .delete(session)
      .where(lt(session.expiresAt, sql`${now}`))
      .returning({ id: session.id });

    ctx.log.info("Deleted expired sessions", { count: expiredSessions.length });

    const expiredVerifications = await ctx.db
      .delete(verification)
      .where(lt(verification.expiresAt, sql`${now}`))
      .returning({ id: verification.id });

    ctx.log.info("Deleted expired verifications", { count: expiredVerifications.length });

    return {
      result: {
        expiredSessions: expiredSessions.length,
        expiredVerifications: expiredVerifications.length,
      },
      metrics: {
        sessionsDeleted: expiredSessions.length,
        verificationsDeleted: expiredVerifications.length,
      },
    };
  },
};
