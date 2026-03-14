import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { AdminBreadcrumbs } from "~/components/admin-breadcrumbs";
import { AdminMobileSidebar, AdminSidebar } from "~/components/admin-sidebar";
import { AdminUserMenu } from "~/components/admin-user-menu";
import { LoadingSkeleton } from "~/components/loading";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { getSession } from "~/lib/get-session";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/login" });
    if ((session.user as Record<string, unknown>).role !== "admin") throw redirect({ to: "/" });
    return { session };
  },
  component: AdminLayout,
  pendingComponent: LoadingSkeleton,
});

function AdminLayout() {
  const { session } = Route.useRouteContext();

  const user = {
    name: session.user.name,
    email: session.user.email,
    username: (session.user as Record<string, unknown>).username as string | null,
  };

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <AdminSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Admin header bar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 p-0 pt-8">
                <AdminMobileSidebar />
              </SheetContent>
            </Sheet>
            <AdminBreadcrumbs />
          </div>
          <AdminUserMenu user={user} />
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
