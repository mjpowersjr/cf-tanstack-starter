import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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

// --- Route ---

export const Route = createFileRoute("/admin/sessions")({
  head: () => ({
    meta: [
      { title: "Sessions | CF TanStack Starter" },
      { name: "description", content: "Manage user sessions across the system." },
      { property: "og:title", content: "Sessions | CF TanStack Starter" },
      { property: "og:description", content: "Manage user sessions across the system." },
    ],
  }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/login" });
    if ((session.user as Record<string, unknown>).role !== "admin") throw redirect({ to: "/" });
    return { session };
  },
  component: SessionsPage,
  pendingComponent: LoadingSkeleton,
});

// --- Types ---

interface UserInfo {
  id: string;
  name: string;
  email: string;
  username: string | null;
}

interface SessionInfo {
  id: string;
  token: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

// --- Components ---

function SessionsPage() {
  const { session: currentSession } = Route.useRouteContext();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session Management</h1>
        <p className="text-muted-foreground">
          View and revoke user sessions. Look up sessions by user.
        </p>
      </div>

      <UserSessionLookup currentSessionToken={currentSession.session.token} />
    </div>
  );
}

function UserSessionLookup({ currentSessionToken }: { currentSessionToken: string }) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await authClient.admin.listUsers({ query: { limit: 100 } });
      if (result.data) {
        setUsers(
          result.data.users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            username: (u as unknown as Record<string, unknown>).username as string | null,
          })),
        );
      }
      setUsersLoaded(true);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionsForUser = async (userId: string) => {
    setSelectedUserId(userId);
    setSessionsLoading(true);
    try {
      const result = await authClient.admin.listUserSessions({ userId });
      if (result.data) {
        const data = result.data as unknown as { sessions: SessionInfo[] };
        setSessions(data.sessions);
      }
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionToken: string) => {
    try {
      await authClient.admin.revokeUserSession({ sessionToken });
      toast.success("Session revoked");
      if (selectedUserId) await fetchSessionsForUser(selectedUserId);
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeAll = async (userId: string) => {
    if (!confirm("Revoke all sessions for this user? They will be logged out everywhere.")) return;
    try {
      await authClient.admin.revokeUserSessions({ userId });
      toast.success("All sessions revoked");
      await fetchSessionsForUser(userId);
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  if (!usersLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Sessions</CardTitle>
          <CardDescription>Select a user to view and manage their active sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchUsers} disabled={loading}>
            {loading ? "Loading..." : "Load Users"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const filteredUsers = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.username?.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return "Unknown device";
    if (ua.length > 60) return `${ua.slice(0, 60)}...`;
    return ua;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{users.length} registered users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-96 space-y-1 overflow-auto">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => fetchSessionsForUser(user.id)}
                className={`w-full rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent ${
                  selectedUserId === user.id ? "border-primary bg-accent" : ""
                }`}
              >
                <div className="font-medium">{user.username ?? user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedUser
                  ? `Sessions for ${selectedUser.username ?? selectedUser.name}`
                  : "Sessions"}
              </CardTitle>
              <CardDescription>
                {selectedUser
                  ? `${sessions.length} active session(s)`
                  : "Select a user to view sessions"}
              </CardDescription>
            </div>
            {selectedUser && sessions.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRevokeAll(selectedUser.id)}
              >
                Revoke All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedUser ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Select a user from the list to view their sessions.
            </p>
          ) : sessionsLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{parseUserAgent(s.userAgent)}</span>
                        {s.token === currentSessionToken && <Badge variant="default">You</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.ipAddress ?? "\u2014"}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(s.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.token === currentSessionToken ? (
                        <span className="text-xs text-muted-foreground">Current</span>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeSession(s.token)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
