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

export { createTracer, type Tracer, type Span, type SpanOptions } from "./tracer";
export { tracingMiddleware } from "./middleware";
