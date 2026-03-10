/**
 * OpenTelemetry-compatible observability for Cloudflare Workers.
 *
 * This package provides:
 * - Trace context propagation (W3C Trace Context)
 * - Span creation and lifecycle management
 * - Structured trace output compatible with CF Workers Logs + OTLP
 * - TanStack Start middleware for automatic server function tracing
 *
 * Cloudflare Workers has native observability that auto-instruments:
 * - Outbound fetch() calls
 * - Worker bindings (D1, R2, KV, DO)
 * - Handler invocation lifecycle
 *
 * This package adds application-level tracing on top of that.
 */

export { cacheMiddleware } from "./cache-middleware";
export { errorMiddleware } from "./error-middleware";
export { tracingMiddleware } from "./middleware";
export { createTracer, type Span, type SpanOptions, type Tracer } from "./tracer";
