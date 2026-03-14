import { tracingMiddleware } from "@repo/observability/middleware";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { LoadingSkeleton } from "~/components/loading";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { authClient } from "~/lib/auth";
import { getSession } from "~/lib/get-session";

const getSignupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await import("cloudflare:workers");
  return env.SIGNUP_ENABLED !== "false";
});

const getFeatureFlags = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .handler(async () => {
    const { env } = await import("cloudflare:workers");
    const { listFlags } = await import("~/lib/feature-flags");
    return listFlags(env.FLAGS);
  });

const FlagSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  enabled: v.boolean(),
});

const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([tracingMiddleware])
  .inputValidator(FlagSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { setFlag } = await import("~/lib/feature-flags");
    await setFlag(env.FLAGS, data.name, data.enabled);
    return { success: true };
  });

const DeleteFlagSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
});

const deleteFeatureFlag = createServerFn({ method: "POST" })
  .middleware([tracingMiddleware])
  .inputValidator(DeleteFlagSchema)
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
      { name: "description", content: "Admin dashboard for user management." },
      { property: "og:title", content: "Admin | CF TanStack Starter" },
      { property: "og:description", content: "Admin dashboard for user management." },
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
  loader: () => getSignupStatus(),
  component: AdminPage,
  pendingComponent: LoadingSkeleton,
});

function AdminPage() {
  const signupEnabled = Route.useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users and site settings.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UserList />
        </div>
        <div className="space-y-6">
          <CreateUserForm />
          <SignupStatusCard enabled={signupEnabled} />
          <FeatureFlagsCard />
        </div>
      </div>
    </div>
  );
}

function UserList() {
  const [users, setUsers] = useState<
    {
      id: string;
      name: string;
      email: string;
      username: string | null;
      role: string | null;
      banned: boolean | null;
      createdAt: string;
    }[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const result = await authClient.admin.listUsers({ query: { limit: 100 } });
    if (result.data) {
      setUsers(
        result.data.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          username: (u as unknown as Record<string, unknown>).username as string | null,
          role: u.role as string | null,
          banned: u.banned as boolean | null,
          createdAt: new Date(u.createdAt).toLocaleDateString(),
        })),
      );
    }
    setLoaded(true);
    setLoading(false);
  };

  const handleSetRole = async (userId: string, role: "admin" | "user") => {
    await authClient.admin.setRole({ userId, role });
    fetchUsers();
  };

  const handleToggleBan = async (userId: string, banned: boolean) => {
    if (banned) {
      await authClient.admin.unbanUser({ userId });
    } else {
      await authClient.admin.banUser({ userId });
    }
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    await authClient.admin.removeUser({ userId });
    fetchUsers();
  };

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage user accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchUsers} disabled={loading}>
            {loading ? "Loading..." : "Load Users"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>{users.length} total users</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username ?? user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role ?? "user"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <Badge variant="destructive">Banned</Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleSetRole(user.id, user.role === "admin" ? "user" : "admin")
                      }
                    >
                      {user.role === "admin" ? "Demote" : "Promote"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleBan(user.id, !!user.banned)}
                    >
                      {user.banned ? "Unban" : "Ban"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CreateUserForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    const result = await authClient.admin.createUser({
      name: username,
      email,
      password,
      role,
      data: { username, displayUsername: username },
    });

    if (result.error) {
      setMessage(result.error.message ?? "Failed to create user");
    } else {
      setMessage("User created successfully");
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("user");
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create User</CardTitle>
        <CardDescription>Add a new user account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {message && <div className="rounded-md border p-3 text-sm">{message}</div>}
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating..." : "Create User"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
    if (!confirm(`Delete flag "${name}"?`)) return;
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
    </Card>
  );
}
