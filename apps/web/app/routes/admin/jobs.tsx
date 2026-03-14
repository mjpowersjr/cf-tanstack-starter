import { TriggerJobSchema } from "@repo/db";
import { tracingMiddleware } from "@repo/observability/middleware";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { LoadingSkeleton } from "~/components/loading";
import { Pagination } from "~/components/pagination";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getSession } from "~/lib/get-session";
import { rateLimitMiddleware } from "~/lib/rate-limit-middleware";

// --- Types ---

// biome-ignore lint/complexity/noBannedTypes: matches Drizzle's text({ mode: "json" }) return type
type JsonColumn = {} | null;

interface JobRun {
  id: number;
  jobName: string;
  triggerType: string;
  triggerCron: string | null;
  triggeredBy: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  result: JsonColumn;
  metrics: JsonColumn;
  error: string | null;
  errorStack: string | null;
  logs: JsonColumn;
}

interface RegisteredJob {
  name: string;
  description: string;
  cron: string | null;
}

// --- Server Functions ---

const getRegisteredJobs = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .handler(async (): Promise<RegisteredJob[]> => {
    const { jobs } = await import("~/jobs/registry");
    return Object.values(jobs).map((j) => ({
      name: j.name,
      description: j.description,
      cron: j.cron,
    }));
  });

const PAGE_SIZE = 20;

const PaginationSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
});

const getJobRuns = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .inputValidator(PaginationSchema)
  .handler(async ({ data }): Promise<{ runs: JobRun[]; total: number }> => {
    const { env } = await import("cloudflare:workers");
    const { createDb, jobRuns } = await import("@repo/db");
    const { desc, sql } = await import("drizzle-orm");
    const db = createDb(env.DB);
    const offset = ((data.page ?? 1) - 1) * PAGE_SIZE;

    const [runs, countResult] = await Promise.all([
      db
        .select()
        .from(jobRuns)
        .orderBy(desc(jobRuns.startedAt))
        .limit(PAGE_SIZE)
        .offset(offset) as Promise<JobRun[]>,
      db.select({ count: sql<number>`count(*)` }).from(jobRuns),
    ]);

    return { runs, total: countResult[0]?.count ?? 0 };
  });

const triggerJob = createServerFn({ method: "POST" })
  .middleware([
    rateLimitMiddleware({ key: "trigger-job", limit: 10, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(TriggerJobSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { jobs } = await import("~/jobs/registry");
    const { executeJob } = await import("~/jobs/runner");
    const session = await getSession();

    const job = jobs[data.jobName];
    if (!job) {
      throw new Error(`Unknown job: ${data.jobName}`);
    }

    await executeJob(job, env, {
      triggerType: "manual",
      triggeredBy: session?.user?.id,
    });

    return { success: true };
  });

// --- Route ---

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs | CF TanStack Starter" },
      { name: "description", content: "View registered background jobs and run history." },
      { property: "og:title", content: "Jobs | CF TanStack Starter" },
      { property: "og:description", content: "View registered background jobs and run history." },
    ],
  }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    if ((session.user as Record<string, unknown>).role !== "admin") {
      throw redirect({ to: "/" });
    }
    return { session };
  },
  loader: async () => {
    const [registeredJobs, runsData] = await Promise.all([
      getRegisteredJobs(),
      getJobRuns({ data: { page: 1 } }),
    ]);
    return { registeredJobs, runsData };
  },
  component: JobsPage,
  pendingComponent: LoadingSkeleton,
});

// --- Components ---

function JobsPage() {
  const { registeredJobs, runsData: initialData } = Route.useLoaderData();
  const [runs, setRuns] = useState(initialData.runs);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(1);
  const [triggering, setTriggering] = useState<string | null>(null);

  const fetchPage = async (p: number) => {
    const data = await getJobRuns({ data: { page: p } });
    setRuns(data.runs);
    setTotal(data.total);
    setPage(p);
  };

  const handleTrigger = async (jobName: string) => {
    setTriggering(jobName);
    try {
      await triggerJob({ data: { jobName } });
      toast.success(`Job "${jobName}" triggered`);
      await fetchPage(1);
    } catch {
      toast.error(`Failed to trigger job "${jobName}"`);
    } finally {
      setTriggering(null);
    }
  };

  const handleRefresh = async () => {
    await fetchPage(page);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Background Jobs</h1>
        <p className="text-muted-foreground">View registered jobs and run history.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {registeredJobs.map((job) => (
          <Card key={job.name}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{job.name}</CardTitle>
              <CardDescription>{job.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {job.cron ? (
                  <Badge variant="outline">
                    <code className="text-xs">{job.cron}</code>
                  </Badge>
                ) : (
                  <Badge variant="secondary">manual only</Badge>
                )}
                <Button
                  size="sm"
                  onClick={() => handleTrigger(job.name)}
                  disabled={triggering === job.name}
                >
                  {triggering === job.name ? "Running..." : "Run Now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>{total} total job runs</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No job runs yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <JobRunRow key={run.id} run={run} />
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={fetchPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobRunRow({ run }: { run: JobRun }) {
  const [expanded, setExpanded] = useState(false);

  const statusVariant =
    run.status === "success" ? "default" : run.status === "error" ? "destructive" : "secondary";

  const logs = run.logs as
    | { level: string; msg: string; ts: number; [key: string]: unknown }[]
    | null;
  const result = run.result as Record<string, unknown> | null;
  const metrics = run.metrics as Record<string, number> | null;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <TableCell className="font-medium">{run.jobName}</TableCell>
        <TableCell>
          <Badge variant={statusVariant}>{run.status}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{run.triggerType}</Badge>
          {run.triggerCron && (
            <code className="ml-1 text-xs text-muted-foreground">{run.triggerCron}</code>
          )}
        </TableCell>
        <TableCell>{run.durationMs != null ? `${run.durationMs}ms` : "\u2014"}</TableCell>
        <TableCell className="text-sm">{run.startedAt}</TableCell>
        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
          {result ? JSON.stringify(result) : "\u2014"}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/50 p-4">
            <div className="space-y-3 text-sm">
              {metrics && (
                <div>
                  <strong>Metrics:</strong>
                  <pre className="mt-1 rounded bg-muted p-2 text-xs">
                    {JSON.stringify(metrics, null, 2)}
                  </pre>
                </div>
              )}
              {result && (
                <div>
                  <strong>Result:</strong>
                  <pre className="mt-1 rounded bg-muted p-2 text-xs">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
              {run.error && (
                <div>
                  <strong>Error:</strong>
                  <pre className="mt-1 rounded bg-destructive/10 p-2 text-xs text-destructive">
                    {run.error}
                    {run.errorStack && `\n\n${run.errorStack}`}
                  </pre>
                </div>
              )}
              {logs && logs.length > 0 && (
                <div>
                  <strong>Logs ({logs.length}):</strong>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
                    {logs
                      .map((entry) => {
                        const { level, msg, ts, ...rest } = entry;
                        const extras =
                          Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
                        return `${new Date(ts).toISOString()} [${level}] ${msg}${extras}`;
                      })
                      .join("\n")}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
