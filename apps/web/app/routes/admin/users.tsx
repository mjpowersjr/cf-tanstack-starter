import {
  CreateUserSchema,
  ListUsersSchema,
  ResetPasswordSchema,
  SetRoleSchema,
  UpdateUserSchema,
  USER_ROLES,
  UserIdSchema,
} from "@repo/db";
import { tracingMiddleware } from "@repo/observability/middleware";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "~/components/confirm-dialog";
import { LoadingSkeleton } from "~/components/loading";
import { Pagination } from "~/components/pagination";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminMiddleware } from "~/lib/admin-middleware";
import { formatDate } from "~/lib/format";
import { rateLimitMiddleware } from "~/lib/rate-limit-middleware";

// --- Server Functions ---

const PAGE_SIZE = 20;

// better-auth admin API + the caller's request headers (the admin endpoints
// re-verify the session, so headers must be forwarded).
async function getAuthApi() {
  const { env } = await import("cloudflare:workers");
  const { createAuth } = await import("~/lib/auth-server");
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  return { auth: createAuth(env), headers: getRequestHeaders() };
}

const listUsers = createServerFn({ method: "GET" })
  .middleware([adminMiddleware, tracingMiddleware])
  .inputValidator(ListUsersSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, user } = await import("@repo/db");
    const { desc, like, or, sql } = await import("drizzle-orm");
    const db = createDb(env.DB);
    const offset = ((data.page ?? 1) - 1) * PAGE_SIZE;
    const term = data.search?.trim();
    const where = term
      ? or(
          like(user.email, `%${term}%`),
          like(user.username, `%${term}%`),
          like(user.name, `%${term}%`),
        )
      : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          banned: user.banned,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(user).where(where),
    ]);

    return { users: rows, total: countResult[0]?.count ?? 0 };
  });

const createUser = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-create-user", limit: 20, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    const { auth, headers } = await getAuthApi();
    await auth.api.createUser({
      body: {
        name: data.username,
        email: data.email,
        password: data.password,
        role: data.role ?? "user",
        data: { username: data.username, displayUsername: data.username },
      },
      headers,
    });
    return { success: true };
  });

const updateUser = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-update-user", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(UpdateUserSchema)
  .handler(async ({ data }) => {
    const { auth, headers } = await getAuthApi();
    await auth.api.adminUpdateUser({
      body: {
        userId: data.userId,
        data: {
          email: data.email,
          username: data.username,
          displayUsername: data.username,
        },
      },
      headers,
    });
    return { success: true };
  });

const setUserRole = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-set-role", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(SetRoleSchema)
  .handler(async ({ data, context }) => {
    // Self-guard: don't let an admin strip their own admin role and lock the
    // team out. Enforced server-side so it can't be bypassed from the client.
    if (data.userId === context.session.user.id && data.role !== "admin") {
      throw new Error("You can't remove your own admin role.");
    }
    const { auth, headers } = await getAuthApi();
    await auth.api.setRole({ body: { userId: data.userId, role: data.role }, headers });
    return { success: true };
  });

const banUser = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-ban-user", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(UserIdSchema)
  .handler(async ({ data, context }) => {
    if (data.userId === context.session.user.id) {
      throw new Error("You can't ban yourself.");
    }
    const { auth, headers } = await getAuthApi();
    await auth.api.banUser({ body: { userId: data.userId }, headers });
    return { success: true };
  });

const unbanUser = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-unban-user", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(UserIdSchema)
  .handler(async ({ data }) => {
    const { auth, headers } = await getAuthApi();
    await auth.api.unbanUser({ body: { userId: data.userId }, headers });
    return { success: true };
  });

const deleteUser = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-delete-user", limit: 20, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(UserIdSchema)
  .handler(async ({ data, context }) => {
    if (data.userId === context.session.user.id) {
      throw new Error("You can't delete your own account here.");
    }
    const { auth, headers } = await getAuthApi();
    await auth.api.removeUser({ body: { userId: data.userId }, headers });
    return { success: true };
  });

const resetPassword = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-reset-password", limit: 20, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(ResetPasswordSchema)
  .handler(async ({ data }) => {
    const { auth, headers } = await getAuthApi();
    await auth.api.setUserPassword({
      body: { userId: data.userId, newPassword: data.password },
      headers,
    });
    return { success: true };
  });

// --- Route ---

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Users | CF TanStack Starter" },
      { name: "description", content: "Manage user accounts, roles, and access." },
      { property: "og:title", content: "Users | CF TanStack Starter" },
      { property: "og:description", content: "Manage user accounts, roles, and access." },
    ],
  }),
  loader: () => listUsers({ data: { page: 1, search: "" } }),
  component: UsersPage,
  pendingComponent: LoadingSkeleton,
});

// --- Types ---

type ListedUser = Awaited<ReturnType<typeof listUsers>>["users"][number];

const adminRoute = getRouteApi("/admin");

// --- Page ---

function UsersPage() {
  const initial = Route.useLoaderData();
  const { session } = adminRoute.useRouteContext();
  const currentUserId = session.user.id;

  const [users, setUsers] = useState<ListedUser[]>(initial.users);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { confirm, dialog } = useConfirm();

  const load = async (nextPage: number, nextSearch: string) => {
    try {
      const data = await listUsers({ data: { page: nextPage, search: nextSearch } });
      // Deleting the last row of a trailing page leaves it empty — step back.
      if (data.users.length === 0 && nextPage > 1) {
        await load(nextPage - 1, nextSearch);
        return;
      }
      setUsers(data.users);
      setTotal(data.total);
      setPage(nextPage);
      setActiveSearch(nextSearch);
    } catch {
      toast.error("Failed to load users");
    }
  };

  const refresh = () => load(page, activeSearch);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, search.trim());
  };

  const clearSearch = () => {
    setSearch("");
    load(1, "");
  };

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed: ${label}`);
    }
  };

  const handleToggleRole = (u: ListedUser) => {
    const nextRole = u.role === "admin" ? "user" : "admin";
    return runAction(`Role set to ${nextRole}`, () =>
      setUserRole({ data: { userId: u.id, role: nextRole } }),
    );
  };

  const handleToggleBan = async (u: ListedUser) => {
    if (u.banned) {
      return runAction("User unbanned", () => unbanUser({ data: { userId: u.id } }));
    }
    const ok = await confirm({
      title: `Ban ${u.username ?? u.name}?`,
      description: "They will be signed out and blocked from signing in until unbanned.",
      confirmLabel: "Ban user",
      variant: "destructive",
    });
    if (ok) await runAction("User banned", () => banUser({ data: { userId: u.id } }));
  };

  const handleDelete = async (u: ListedUser) => {
    const ok = await confirm({
      title: `Delete ${u.username ?? u.name}?`,
      description: "This permanently removes the account. This cannot be undone.",
      confirmLabel: "Delete user",
      variant: "destructive",
    });
    if (ok) await runAction("User deleted", () => deleteUser({ data: { userId: u.id } }));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">{total} total user(s). Manage roles and access.</p>
        </div>
        <CreateUserDialog onCreated={refresh} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>
                {activeSearch ? `Results for "${activeSearch}"` : "All registered users"}
              </CardDescription>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search email, username, name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
              {activeSearch && (
                <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>
                  Clear
                </Button>
              )}
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {activeSearch ? "No users match your search." : "No users yet."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.username ?? u.name}
                          {isSelf && (
                            <Badge variant="outline" className="ml-2">
                              You
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                            {u.role ?? "user"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.banned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(u.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <EditUserDialog user={u} onSaved={refresh} />
                            <ResetPasswordDialog user={u} />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf}
                              title={isSelf ? "You can't change your own role here" : undefined}
                              onClick={() => handleToggleRole(u)}
                            >
                              {u.role === "admin" ? "Demote" : "Promote"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf}
                              title={isSelf ? "You can't ban yourself" : undefined}
                              onClick={() => handleToggleBan(u)}
                            >
                              {u.banned ? "Unban" : "Ban"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isSelf}
                              title={isSelf ? "You can't delete your own account here" : undefined}
                              onClick={() => handleDelete(u)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={(p) => load(p, activeSearch)}
              />
            </>
          )}
        </CardContent>
      </Card>
      {dialog}
    </div>
  );
}

// --- Dialogs ---

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof USER_ROLES)[number]>("user");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUser({ data: { username, email, password, role } });
      toast.success("User created");
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("user");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Create User</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Add a new account. They can sign in immediately.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-username">Username</Label>
            <Input
              id="create-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-role">Role</Label>
            <select
              id="create-role"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof USER_ROLES)[number])}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onSaved }: { user: ListedUser; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateUser({ data: { userId: user.id, username, email } });
      toast.success("User updated");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setUsername(user.username ?? "");
          setEmail(user.email);
        }
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update the account's username and email.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-username">Username</Label>
            <Input
              id="edit-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user }: { user: ListedUser }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await resetPassword({ data: { userId: user.id, password } });
      toast.success("Password reset");
      setPassword("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPassword("");
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Reset PW
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.username ?? user.name}. They are not notified.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
