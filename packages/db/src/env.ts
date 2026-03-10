/**
 * Runtime validation that required Cloudflare bindings exist.
 *
 * Call at the entry point of server functions to fail fast
 * with a clear error message if bindings are misconfigured.
 *
 * ```ts
 * const { env } = await import("cloudflare:workers");
 * assertBindings(env);
 * ```
 */
export function assertBindings(env: Record<string, unknown>): void {
  const required = ["DB", "BUCKET", "BETTER_AUTH_SECRET"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Cloudflare bindings: ${missing.join(", ")}. ` +
        "Check your wrangler.jsonc configuration.",
    );
  }
}
