import { dbCleanup } from "./definitions/db-cleanup";
import { healthCheck } from "./definitions/health-check";
import type { JobDefinition } from "./types";

export const jobs: Record<string, JobDefinition> = {
  [dbCleanup.name]: dbCleanup,
  [healthCheck.name]: healthCheck,
};

export function getJobsForCron(cron: string): JobDefinition[] {
  return Object.values(jobs).filter((job) => job.cron === cron);
}
