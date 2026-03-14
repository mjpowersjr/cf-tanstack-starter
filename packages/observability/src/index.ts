/**
 * Observability for Cloudflare Workers.
 *
 * Cloudflare Workers has native observability that auto-instruments:
 * - Outbound fetch() calls
 * - Worker bindings (D1, R2, KV, DO)
 * - Handler invocation lifecycle
 * - Console output → OTel logs
 *
 * Enable in wrangler.jsonc:
 *   "observability": { "enabled": true }
 *
 * This package adds:
 * - tracingMiddleware: Structured logging for TanStack server functions
 * - getTracer / withSpan: OTel API helpers for custom spans (no-op
 *   until a TracerProvider is registered via @microlabs/otel-cf-workers
 *   or Cloudflare's native custom span support)
 */

export { tracingMiddleware } from "./middleware";
export { getTracer, type Span, SpanStatusCode, withSpan } from "./tracer";
