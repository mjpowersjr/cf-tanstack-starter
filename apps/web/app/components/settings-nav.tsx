import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { KeyRound, MonitorSmartphone, Palette, User } from "lucide-react";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  exact?: boolean;
}

const items: NavItem[] = [
  { label: "Profile", to: "/settings", icon: User, exact: true },
  { label: "Security", to: "/settings/security", icon: KeyRound },
  { label: "Sessions", to: "/settings/sessions", icon: MonitorSmartphone },
  { label: "Appearance", to: "/settings/appearance", icon: Palette },
];

export function SettingsNav() {
  const { pathname } = useLocation();
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to || pathname === `${to}/` : pathname.startsWith(to);

  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 lg:w-48 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map(({ label, to, icon: Icon, exact }) => {
        const active = isActive(to, exact);
        return (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
