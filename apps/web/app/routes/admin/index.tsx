import { tracingMiddleware } from "@repo/observability/middleware";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Briefcase, FileText, MessageSquare, Shield, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { useConfirm } from "~/components/confirm-dialog";
import { LoadingSkeleton } from "~/components/loading";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { adminMiddleware } from "~/lib/admin-middleware";
import { rateLimitMiddleware } from "~/lib/rate-limit-middleware";

const getOverview = createServerFn({ method: "GET" })
  .middleware([adminMiddleware, tracingMiddleware])
  .handler(async () => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries, jobRuns, session, uploadedFiles, user } = await import(
      "@repo/db"
    );
    const { sql } = await import("drizzle-orm");
    const db = createDb(env.DB);

    // Per-table so one failing count doesn't blank the whole dashboard.
    const tables = {
      users: user,
      sessions: session,
      files: uploadedFiles,
      guestbook: guestbookEntries,
      jobRuns: jobRuns,
    } as const;
    const entries = await Promise.all(
      Object.entries(tables).map(async ([name, table]) => {
        try {
          const [row] = await db.select({ count: sql<number>`count(*)` }).from(table);
          return [name, row?.count ?? 0] as const;
        } catch {
          return [name, null] as const;
        }
      }),
    );

    return {
      signupEnabled: env.SIGNUP_ENABLED !== "false",
      counts: Object.fromEntries(entries) as Record<string, number | null>,
    };
  });

const getFeatureFlags = createServerFn({ method: "GET" })
  .middleware([adminMiddleware, tracingMiddleware])
  .handler(async () => {
    const { env } = await import("cloudflare:workers");
    const { listFlags } = await import("~/lib/feature-flags");
    return listFlags(env.FLAGS);
  });

// kebab-case only: `useFlag("my flag ")` typos would otherwise be invisible
const flagName = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(100),
  v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Flag names must be kebab-case (e.g. new-dashboard)"),
);

const FlagSchema = v.object({
  name: flagName,
  enabled: v.boolean(),
});

const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "set-flag", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .validator(FlagSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { setFlag } = await import("~/lib/feature-flags");
    await setFlag(env.FLAGS, data.name, data.enabled);
    return { success: true };
  });

const DeleteFlagSchema = v.object({
  name: flagName,
});

const deleteFeatureFlag = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "delete-flag", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .validator(DeleteFlagSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { deleteFlag } = await import("~/lib/feature-flags");
    await deleteFlag(env.FLAGS, data.name);
    return { success: true };
  });

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin | CF TanStack Starter" },
      { name: "description", content: "Admin dashboard overview." },
      { property: "og:title", content: "Admin | CF TanStack Starter" },
      { property: "og:description", content: "Admin dashboard overview." },
    ],
  }),
  loader: () => getOverview(),
  component: AdminPage,
  pendingComponent: LoadingSkeleton,
});

const STAT_CARDS = [
  { key: "users", label: "Users", icon: Users, href: "/admin/users" },
  { key: "sessions", label: "Sessions", icon: Shield, href: "/admin/sessions" },
  { key: "files", label: "Files", icon: FileText, href: "/admin/files" },
  { key: "guestbook", label: "Guestbook", icon: MessageSquare, href: "/admin/guestbook" },
  { key: "jobRuns", label: "Job Runs", icon: Briefcase, href: "/admin/jobs" },
] as const;

function AdminPage() {
  const { signupEnabled, counts } = Route.useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">An overview of your site. Jump into any area below.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} to={href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {counts[key] === null || counts[key] === undefined
                    ? "—"
                    : counts[key]?.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <FeatureFlagsCard />
        <SignupStatusCard enabled={signupEnabled} />
      </div>
    </div>
  );
}

function SignupStatusCard({ enabled }: { enabled: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signup Status</CardTitle>
        <CardDescription>
          Public registration is currently{" "}
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "open" : "closed"}</Badge>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Toggle via the <code className="text-xs">SIGNUP_ENABLED</code> environment variable.
          Admin-created users and <code className="text-xs">ADMIN_EMAILS</code> accounts are exempt.
        </p>
      </CardContent>
    </Card>
  );
}

function FeatureFlagsCard() {
  const [flags, setFlags] = useState<{ name: string; enabled: boolean }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newFlagName, setNewFlagName] = useState("");
  const { confirm, dialog } = useConfirm();

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const result = await getFeatureFlags();
      setFlags(result);
      setLoaded(true);
    } catch {
      toast.error("Failed to load feature flags");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (name: string, currentEnabled: boolean) => {
    try {
      await setFeatureFlag({ data: { name, enabled: !currentEnabled } });
      toast.success(`Flag "${name}" ${!currentEnabled ? "enabled" : "disabled"}`);
      await fetchFlags();
    } catch {
      toast.error("Failed to update flag");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFlagName.trim();
    if (!name) return;
    try {
      await setFeatureFlag({ data: { name, enabled: false } });
      setNewFlagName("");
      toast.success(`Flag "${name}" created`);
      await fetchFlags();
    } catch {
      toast.error("Failed to create flag");
    }
  };

  const handleDelete = async (name: string) => {
    const ok = await confirm({
      title: `Delete flag "${name}"?`,
      description: "Any code reading this flag will fall back to disabled.",
      confirmLabel: "Delete flag",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteFeatureFlag({ data: { name } });
      toast.success(`Flag "${name}" deleted`);
      await fetchFlags();
    } catch {
      toast.error("Failed to delete flag");
    }
  };

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Feature Flags <Badge variant="secondary">KV</Badge>
          </CardTitle>
          <CardDescription>Manage feature flags stored in Cloudflare KV.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchFlags} disabled={loading}>
            {loading ? "Loading..." : "Load Flags"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Feature Flags <Badge variant="secondary">KV</Badge>
        </CardTitle>
        <CardDescription>{flags.length} flag(s) configured</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            placeholder="new-flag-name"
            value={newFlagName}
            onChange={(e) => setNewFlagName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flags configured yet.</p>
        ) : (
          <div className="space-y-2">
            {flags.map((flag) => (
              <div
                key={flag.name}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={flag.enabled ? "default" : "outline"}>
                    {flag.enabled ? "ON" : "OFF"}
                  </Badge>
                  <code className="text-sm">{flag.name}</code>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(flag.name, flag.enabled)}
                  >
                    {flag.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(flag.name)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {dialog}
    </Card>
  );
}
