import { getRouteApi } from "@tanstack/react-router";

const rootRoute = getRouteApi("__root__");

/**
 * Reads a feature flag from the router context. Flags are loaded once per
 * request in the root route's `beforeLoad` and exposed via context, so this
 * hook performs no extra network calls.
 *
 * Returns `false` for disabled or unset flags.
 *
 * Example:
 *   const showBanner = useFlag("home-banner");
 *   if (showBanner) return <Banner />;
 */
export function useFlag(name: string): boolean {
  const { flags } = rootRoute.useRouteContext();
  return flags[name] === true;
}
