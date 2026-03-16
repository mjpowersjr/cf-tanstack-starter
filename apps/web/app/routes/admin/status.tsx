import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingSkeleton } from "~/components/loading";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { createAdminServerFn } from "~/lib/server-fn";

// --- Server Functions ---

const getSystemStatus = createAdminServerFn().handler(async () => {
  const { env } = await import("cloudflare:workers");
  const { createDb, uploadedFiles } = await import("@repo/db");
  const { sql } = await import("drizzle-orm");
  const db = createDb(env.DB);

  const checks: Record<string, { status: "ok" | "error"; detail?: string }> = {};

  // D1
  try {
    const result = await env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();
    checks.d1 = { status: result?.ok === 1 ? "ok" : "error" };
  } catch (e) {
    checks.d1 = { status: "error", detail: e instanceof Error ? e.message : String(e) };
  }

  // R2
  try {
    await env.BUCKET.list({ limit: 1 });
    checks.r2 = { status: "ok" };
  } catch (e) {
    checks.r2 = { status: "error", detail: e instanceof Error ? e.message : String(e) };
  }

  // KV (Rate Limit)
  try {
    await env.RATE_LIMIT.get("__health_check__");
    checks.kv_rate_limit = { status: "ok" };
  } catch (e) {
    checks.kv_rate_limit = {
      status: "error",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  // KV (Flags)
  try {
    await env.FLAGS.get("__health_check__");
    checks.kv_flags = { status: "ok" };
  } catch (e) {
    checks.kv_flags = { status: "error", detail: e instanceof Error ? e.message : String(e) };
  }

  // Stats
  const stats: Record<string, number> = {};
  try {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(sql`user`);
    stats.users = userCount?.count ?? 0;

    const [sessionCount] = await db.select({ count: sql<number>`count(*)` }).from(sql`session`);
    stats.sessions = sessionCount?.count ?? 0;

    const [fileCount] = await db.select({ count: sql<number>`count(*)` }).from(uploadedFiles);
    stats.files = fileCount?.count ?? 0;

    const [entryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sql`guestbook_entries`);
    stats.guestbook_entries = entryCount?.count ?? 0;

    const [jobRunCount] = await db.select({ count: sql<number>`count(*)` }).from(sql`job_runs`);
    stats.job_runs = jobRunCount?.count ?? 0;
  } catch {
    // Stats are best-effort
  }

  return {
    timestamp: new Date().toISOString(),
    checks,
    stats,
    config: {
      signup_enabled: env.SIGNUP_ENABLED !== "false",
      email_configured: !!env.RESEND_API_KEY,
    },
  };
});

// --- Route ---

export const Route = createFileRoute("/admin/status")({
  head: () => ({
    meta: [
      { title: "System Status | CF TanStack Starter" },
      { name: "description", content: "System health and configuration overview." },
      { property: "og:title", content: "System Status | CF TanStack Starter" },
      { property: "og:description", content: "System health and configuration overview." },
    ],
  }),
  loader: () => getSystemStatus(),
  component: StatusPage,
  pendingComponent: LoadingSkeleton,
});

// --- Types ---

type StatusData = Awaited<ReturnType<typeof getSystemStatus>>;

// --- Components ---

function StatusPage() {
  const initialData = Route.useLoaderData();
  const [data, setData] = useState<StatusData>(initialData);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const updated = await getSystemStatus();
      setData(updated);
      toast.success("Status refreshed");
    } catch {
      toast.error("Failed to refresh status");
    } finally {
      setRefreshing(false);
    }
  };

  const allHealthy = Object.values(data.checks).every((c) => c.status === "ok");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
          <p className="text-muted-foreground">
            Last checked: {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={allHealthy ? "default" : "destructive"}>
            {allHealthy ? "All Systems OK" : "Issues Detected"}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
            <CardDescription>Connectivity status for all Cloudflare bindings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.checks).map(([name, check]) => (
              <div key={name} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${check.status === "ok" ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <div>
                    <div className="font-medium">{formatServiceName(name)}</div>
                    {check.detail && <div className="text-xs text-destructive">{check.detail}</div>}
                  </div>
                </div>
                <Badge variant={check.status === "ok" ? "outline" : "destructive"}>
                  {check.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Stats</CardTitle>
            <CardDescription>Record counts across all tables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.stats).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between rounded-md border p-3">
                <span className="font-medium">{formatStatName(name)}</span>
                <span className="font-mono text-lg">{count.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Runtime configuration state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="font-medium">Public Signup</span>
                <Badge variant={data.config.signup_enabled ? "default" : "secondary"}>
                  {data.config.signup_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="font-medium">Email (Resend)</span>
                <Badge variant={data.config.email_configured ? "default" : "secondary"}>
                  {data.config.email_configured ? "Configured" : "Not configured"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatServiceName(name: string): string {
  const names: Record<string, string> = {
    d1: "D1 (SQLite)",
    r2: "R2 (Object Storage)",
    kv_rate_limit: "KV (Rate Limiting)",
    kv_flags: "KV (Feature Flags)",
  };
  return names[name] ?? name;
}

function formatStatName(name: string): string {
  const names: Record<string, string> = {
    users: "Users",
    sessions: "Active Sessions",
    files: "Uploaded Files",
    guestbook_entries: "Guestbook Entries",
    job_runs: "Job Runs",
  };
  return names[name] ?? name;
}
