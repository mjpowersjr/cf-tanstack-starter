import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

/**
 * Shown instead of page content while the `maintenance-mode` feature flag is
 * enabled (see __root.tsx). Admins bypass it so they can turn the flag back
 * off from /admin.
 */
export function MaintenancePage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Down for maintenance</CardTitle>
          <CardDescription>
            We're doing some scheduled work on the site. Please check back shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you need help right away, contact the site operator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
