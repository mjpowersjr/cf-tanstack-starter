import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getJobsForCron, jobs } from "./registry";

/** Strip // and /* *\/ comments from JSONC without touching string contents. */
function parseJsonc(source: string): unknown {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"') {
      out += ch;
      i++;
      while (i < source.length) {
        out += source[i];
        if (source[i] === "\\") {
          out += source[i + 1];
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return JSON.parse(out);
}

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

describe("cron trigger drift", () => {
  // getJobsForCron matches by EXACT string equality against the cron strings
  // Cloudflare delivers from wrangler.jsonc triggers. A job whose cron isn't
  // declared there silently never runs.
  const wrangler = parseJsonc(
    readFileSync(`${import.meta.dirname}/../../wrangler.jsonc`, "utf8"),
  ) as {
    triggers?: { crons?: string[] };
    env?: Record<string, { triggers?: { crons?: string[] } }>;
  };

  it("every scheduled job's cron is declared in wrangler.jsonc triggers", () => {
    const declared = new Set(wrangler.triggers?.crons ?? []);
    const missing = Object.values(jobs)
      .filter((job) => job.cron !== null && !declared.has(job.cron))
      .map((job) => `${job.name}: "${job.cron}"`);
    expect(
      missing,
      `These jobs have cron schedules not present in wrangler.jsonc "triggers.crons" — they will never fire:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("every declared trigger matches at least one job (no dead crons)", () => {
    const dead = (wrangler.triggers?.crons ?? []).filter(
      (cron) => getJobsForCron(cron).length === 0,
    );
    expect(dead, `These wrangler.jsonc crons match no registered job:\n${dead.join("\n")}`).toEqual(
      [],
    );
  });

  it("named environments declare the same triggers as production", () => {
    for (const [name, envConfig] of Object.entries(wrangler.env ?? {})) {
      expect(
        envConfig.triggers?.crons ?? [],
        `env "${name}" triggers differ from top-level (wrangler envs do not inherit triggers)`,
      ).toEqual(wrangler.triggers?.crons ?? []);
    }
  });
});
