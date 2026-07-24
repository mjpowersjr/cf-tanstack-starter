import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/lib/auth";
import { formatDate } from "~/lib/format";

export const Route = createFileRoute("/settings/")({
  component: ProfilePage,
});

function ProfilePage() {
  const router = useRouter();
  const { session } = Route.useRouteContext();
  const user = session.user as Record<string, unknown>;

  const [name, setName] = useState((user.name as string) ?? "");
  const [submitting, setSubmitting] = useState(false);

  const initialName = (user.name as string) ?? "";
  const dirty = name.trim() !== initialName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) throw new Error(result.error.message);
      // Refresh the router so the header/greeting pick up the new name.
      await router.invalidate();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  };

  const memberSince = user.createdAt ? formatDate(user.createdAt as string) : "—";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <Button type="submit" disabled={submitting || !dirty}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Read-only account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <InfoRow label="Username" value={(user.username as string) ?? "—"} />
          <InfoRow
            label="Email"
            value={
              <span className="flex items-center gap-2">
                {user.email as string}
                {user.emailVerified ? (
                  <Badge variant="outline">Verified</Badge>
                ) : (
                  <Badge variant="secondary">Unverified</Badge>
                )}
              </span>
            }
          />
          <InfoRow
            label="Role"
            value={
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {(user.role as string) ?? "user"}
              </Badge>
            }
          />
          <InfoRow label="Member since" value={memberSince} />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
