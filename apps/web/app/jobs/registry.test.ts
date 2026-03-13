import { describe, expect, it } from "vitest";
import { getJobsForCron, jobs } from "./registry";

describe("job registry", () => {
  it("registers db-cleanup and health-check jobs", () => {
    expect(Object.keys(jobs)).toContain("db-cleanup");
    expect(Object.keys(jobs)).toContain("health-check");
  });

  it("all registered jobs have required fields", () => {
    for (const job of Object.values(jobs)) {
      expect(job.name).toBeTruthy();
      expect(job.description).toBeTruthy();
      expect(typeof job.handler).toBe("function");
    }
  });

  it("getJobsForCron returns matching jobs", () => {
    const hourly = getJobsForCron("0 * * * *");
    expect(hourly.some((j) => j.name === "db-cleanup")).toBe(true);

    const every15 = getJobsForCron("*/15 * * * *");
    expect(every15.some((j) => j.name === "health-check")).toBe(true);
  });

  it("getJobsForCron returns empty array for unknown cron", () => {
    expect(getJobsForCron("0 0 31 2 *")).toEqual([]);
  });
});
