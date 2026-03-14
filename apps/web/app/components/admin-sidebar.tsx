import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  Briefcase,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Shield,
} from "lucide-react";
import { ScrollArea } from "~/components/ui/scroll-area";

const navGroups = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    items: [
      { label: "Guestbook", href: "/admin/guestbook", icon: MessageSquare },
      { label: "Files", href: "/admin/files", icon: FileText },
    ],
  },
  {
    label: "Users",
    items: [{ label: "Sessions", href: "/admin/sessions", icon: Shield }],
  },
  {
    label: "System",
    items: [
      { label: "Jobs", href: "/admin/jobs", icon: Briefcase },
      { label: "Status", href: "/admin/status", icon: Activity },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin" || location.pathname === "/admin/";
    return location.pathname.startsWith(href);
  };

  return (
    <aside className="hidden w-56 shrink-0 border-r lg:block">
      <ScrollArea className="h-full py-4">
        <nav className="space-y-6 px-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

export function AdminMobileSidebar() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin" || location.pathname === "/admin/";
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="space-y-6 px-1 py-4">
      {navGroups.map((group) => (
        <div key={group.label}>
          <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h4>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
