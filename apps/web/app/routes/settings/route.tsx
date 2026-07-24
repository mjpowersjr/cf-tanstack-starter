import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LoadingSkeleton } from "~/components/loading";
import { SettingsNav } from "~/components/settings-nav";
import { getSession } from "~/lib/get-session";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | CF TanStack Starter" },
      { name: "description", content: "Manage your account, security, and preferences." },
      { property: "og:title", content: "Settings | CF TanStack Starter" },
      { property: "og:description", content: "Manage your account, security, and preferences." },
    ],
  }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: SettingsLayout,
  pendingComponent: LoadingSkeleton,
});

function SettingsLayout() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account, security, and preferences.</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
