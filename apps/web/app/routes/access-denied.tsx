import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const Route = createFileRoute("/access-denied")({
  head: () => ({
    meta: [{ title: "Access Denied | CF TanStack Starter" }],
  }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>Your account doesn't have permission to view that page.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings">Account Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
