/**
 * Theme preference helpers.
 *
 * The stored value lives in `localStorage` under "theme" and is one of
 * "light" | "dark" | (absent = follow the OS). The inline script in
 * `__root.tsx` reads the same key on first paint to avoid a flash, so keep the
 * storage contract in sync with it.
 */

export type Theme = "light" | "dark" | "system";

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function applyTheme(theme: Theme): void {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

/** Persist the preference and apply it immediately. */
export function setTheme(theme: Theme): void {
  if (theme === "system") {
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", theme);
  }
  applyTheme(theme);
}
