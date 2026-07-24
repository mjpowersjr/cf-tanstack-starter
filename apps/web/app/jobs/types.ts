import type { Database } from "@repo/db";
import type { Logger } from "@repo/logger";

export interface JobContext {
  db: Database;
  env: Cloudflare.Env;
  log: Logger;
  triggerType: "cron" | "manual";
  triggerCron?: string;
  triggeredBy?: string;
}

export interface JobResult {
  result: Record<string, unknown>;
  metrics: Record<string, number>;
}

export interface JobDefinition {
  name: string;
  description: string;
  cron: string | null;
  /** Wall-clock cap for one run; the run is recorded as "error" when exceeded. Default 5 minutes. */
  timeoutMs?: number;
  handler: (ctx: JobContext) => Promise<JobResult>;
}
