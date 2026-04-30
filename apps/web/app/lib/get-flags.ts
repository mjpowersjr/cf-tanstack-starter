import { createServerFn } from "@tanstack/react-start";

/**
 * Public server function that returns the set of currently-enabled feature
 * flags as a record. Loaded once per request from the root route and exposed
 * via the router context, then consumed in components with `useFlag(name)`.
 *
 * Flag names are visible to all clients — don't use this for secrets. Gate
 * sensitive logic by checking flags inside server-only code instead.
 */
export const getFlags = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await import("cloudflare:workers");
  const { getEnabledFlags } = await import("~/lib/feature-flags");
  return getEnabledFlags(env.FLAGS);
});
