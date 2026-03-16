import { tracingMiddleware } from "@repo/observability/middleware";
import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "~/lib/admin-middleware";

/**
 * Create a server function requiring admin auth, with tracing pre-applied.
 * Chain `.middleware([rateLimitMiddleware(...)])` to add rate limiting.
 */
export function createAdminServerFn(opts: { method: "GET" | "POST" } = { method: "GET" }) {
  return createServerFn(opts).middleware([adminMiddleware, tracingMiddleware]);
}

/**
 * Create a public server function with tracing pre-applied.
 * Chain `.middleware([rateLimitMiddleware(...)])` to add rate limiting.
 */
export function createPublicServerFn(opts: { method: "GET" | "POST" } = { method: "GET" }) {
  return createServerFn(opts).middleware([tracingMiddleware]);
}
