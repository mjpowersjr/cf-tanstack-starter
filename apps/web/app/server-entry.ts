import tanstackEntry from "@tanstack/react-start/server-entry";
import { getJobsForCron } from "./jobs/registry";
import { executeJob, sweepStaleRuns } from "./jobs/runner";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Report-Only baseline so deployments start with *something* — watch the
  // console for violations, tighten to your app, then rename to
  // Content-Security-Policy to enforce. 'unsafe-inline' is needed for the
  // inline theme script in __root.tsx and Vite's injected styles.
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

export default {
  async fetch(...args: Parameters<typeof tanstackEntry.fetch>): Promise<Response> {
    // Re-wrap: the framework can return an immutable (fetched) Response whose
    // headers throw on mutation.
    const upstream = await tanstackEntry.fetch(...args);
    const response = new Response(upstream.body, upstream);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  },

  // Cloudflare scheduled event handler
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    // Recover runs whose worker died before finalizing the row.
    ctx.waitUntil(sweepStaleRuns(env).catch(() => {}));

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
