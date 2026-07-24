import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "~/components/confirm-dialog";
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
import { formatDate, formatUserAgent } from "~/lib/format";

export const Route = createFileRoute("/settings/sessions")({
  component: SessionsPage,
});

interface SessionInfo {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

function SessionsPage() {
  const { session: currentSession } = Route.useRouteContext();
  const currentSessionToken = currentSession.session.token;

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const result = await authClient.listSessions();
      if (result.error) throw new Error(result.error.message);
      setSessions((result.data ?? []) as SessionInfo[]);
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount
  useEffect(() => {
    fetchSessions();
  }, []);

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
    const ok = await confirm({
      title: "Sign out other devices?",
      description: "Every session except this one will be revoked.",
      confirmLabel: "Sign out others",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await authClient.revokeOtherSessions();
      toast.success("Other sessions revoked");
      await fetchSessions();
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                {loading ? "Loading..." : `${sessions.length} active session(s)`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {sessions.length > 1 && (
                <Button variant="destructive" size="sm" onClick={handleRevokeOthers}>
                  Sign Out Others
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchSessions} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading sessions...</p>
          ) : (
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
                        <span className="text-sm">{formatUserAgent(s.userAgent)}</span>
                        {s.token === currentSessionToken && (
                          <Badge variant="default">Current</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.ipAddress ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(s.createdAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(s.expiresAt)}</TableCell>
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
          )}
        </CardContent>
      </Card>
      {dialog}
    </>
  );
}
