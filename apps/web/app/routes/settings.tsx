import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingSkeleton } from "~/components/loading";
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
import { authClient } from "~/lib/auth";
import { getSession } from "~/lib/get-session";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | CF TanStack Starter" },
      { name: "description", content: "Manage your account and active sessions." },
      { property: "og:title", content: "Settings | CF TanStack Starter" },
      { property: "og:description", content: "Manage your account and active sessions." },
    ],
  }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: SettingsPage,
  pendingComponent: LoadingSkeleton,
});

function SettingsPage() {
  const { session: currentSession } = Route.useRouteContext();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and active sessions.</p>
      </div>

      <SessionsCard currentSessionToken={currentSession.session.token} />
    </div>
  );
}

interface SessionInfo {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

function SessionsCard({ currentSessionToken }: { currentSessionToken: string }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    const result = await authClient.listSessions();
    if (result.data) {
      setSessions(result.data as SessionInfo[]);
    }
    setLoaded(true);
    setLoading(false);
  };

  const handleRevoke = async (token: string) => {
    setRevoking(token);
    try {
      await authClient.revokeSession({ token });
      toast.success("Session revoked");
      await fetchSessions();
    } catch {
      toast.error("Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!confirm("Revoke all other sessions? You will remain logged in.")) return;
    try {
      await authClient.revokeSessions();
      toast.success("All other sessions revoked");
      await fetchSessions();
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>View and manage your active sessions across devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchSessions} disabled={loading}>
            {loading ? "Loading..." : "Load Sessions"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return "Unknown device";
    if (ua.length > 80) return `${ua.slice(0, 80)}...`;
    return ua;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>{sessions.length} active session(s)</CardDescription>
          </div>
          <div className="flex gap-2">
            {sessions.length > 1 && (
              <Button variant="destructive" size="sm" onClick={handleRevokeOthers}>
                Revoke All Others
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>IP Address</TableHead>
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
                    {s.token === currentSessionToken && <Badge variant="default">Current</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{s.ipAddress ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {new Date(s.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(s.expiresAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {s.token === currentSessionToken ? (
                    <span className="text-xs text-muted-foreground">Current session</span>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revoking === s.token}
                      onClick={() => handleRevoke(s.token)}
                    >
                      {revoking === s.token ? "..." : "Revoke"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
