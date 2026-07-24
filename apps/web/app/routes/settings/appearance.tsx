import { createFileRoute } from "@tanstack/react-router";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { readStoredTheme, setTheme, type Theme } from "~/lib/theme";

export const Route = createFileRoute("/settings/appearance")({
  component: AppearancePage,
});

const OPTIONS: { value: Theme; label: string; icon: typeof Sun; hint: string }[] = [
  { value: "light", label: "Light", icon: Sun, hint: "Always use the light theme" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Always use the dark theme" },
  { value: "system", label: "System", icon: Monitor, hint: "Match your device setting" },
];

function AppearancePage() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setMounted(true);
  }, []);

  const choose = (next: Theme) => {
    setThemeState(next);
    setTheme(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how the app looks. Saved to this browser.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map(({ value, label, icon: Icon, hint }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => choose(value)}
                className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-accent ${
                  active ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                {active && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
                <Icon className="h-5 w-5" />
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
