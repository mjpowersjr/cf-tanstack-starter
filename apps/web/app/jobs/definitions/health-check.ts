import { user } from "@repo/db";
import { sql } from "drizzle-orm";
import type { JobDefinition } from "../types";

export const healthCheck: JobDefinition = {
  name: "health-check",
  description: "Check D1 connectivity, R2 accessibility, and user count",
  cron: "*/15 * * * *",
  handler: async (ctx) => {
    const checks: Record<string, unknown> = {};
    let healthy = true;

    // Check D1
    try {
      const result = await ctx.db.get<{ ok: number }>(sql`SELECT 1 as ok`);
      checks.d1 = result?.ok === 1 ? "ok" : "unexpected";
      if (result?.ok !== 1) healthy = false;
    } catch (e) {
      checks.d1 = "error";
      healthy = false;
      ctx.log.error(
        {
          error: e instanceof Error ? e.message : String(e),
        },
        "D1 health check failed",
      );
    }

    // Check R2
    try {
      const list = await ctx.env.BUCKET.list({ limit: 1 });
      checks.r2 = list ? "ok" : "error";
    } catch (e) {
      checks.r2 = "error";
      healthy = false;
      ctx.log.error(
        {
          error: e instanceof Error ? e.message : String(e),
        },
        "R2 health check failed",
      );
    }

    // User count
    let userCount = 0;
    try {
      const result = await ctx.db.select({ count: sql<number>`count(*)` }).from(user);
      userCount = result[0]?.count ?? 0;
      checks.userCount = userCount;
    } catch (e) {
      checks.userCount = "error";
      ctx.log.error(
        {
          error: e instanceof Error ? e.message : String(e),
        },
        "User count check failed",
      );
    }

    ctx.log.info({ healthy, checks }, "Health check complete");

    return {
      result: { healthy, checks },
      metrics: { healthy: healthy ? 1 : 0, userCount },
    };
  },
};
