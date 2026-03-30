import tanstackEntry from "@tanstack/react-start/server-entry";
import { getJobsForCron } from "./jobs/registry";
import { executeJob } from "./jobs/runner";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export default {
  async fetch(...args: Parameters<typeof tanstackEntry.fetch>): Promise<Response> {
    const response = await tanstackEntry.fetch(...args);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  },

  // Cloudflare scheduled event handler
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const matchingJobs = getJobsForCron(controller.cron);
    for (const job of matchingJobs) {
      ctx.waitUntil(
        executeJob(job, env, {
          triggerType: "cron",
          triggerCron: controller.cron,
        }),
      );
    }
  },
};
