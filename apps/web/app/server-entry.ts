import tanstackEntry from "@tanstack/react-start/server-entry";
import { getJobsForCron } from "./jobs/registry";
import { executeJob } from "./jobs/runner";

export default {
  // Delegate HTTP requests to TanStack Start
  fetch: tanstackEntry.fetch,

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
