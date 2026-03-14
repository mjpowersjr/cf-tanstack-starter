import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";

const SERVICE_NAME = "cf-tanstack-starter";

/**
 * Get a tracer instance for creating custom spans.
 *
 * Returns a real OpenTelemetry tracer. By default this is a no-op
 * (spans are created but not exported) until a TracerProvider is
 * registered — either by Cloudflare's native custom span support
 * (when it ships) or by wiring in @microlabs/otel-cf-workers.
 *
 * Usage:
 *   import { getTracer } from "@repo/observability";
 *   const tracer = getTracer();
 *   await tracer.startActiveSpan("my-operation", async (span) => {
 *     span.setAttribute("key", "value");
 *     // ... do work ...
 *   });
 */
export function getTracer(name: string = SERVICE_NAME) {
  return trace.getTracer(name);
}

/**
 * Convenience wrapper for creating a span around an async operation.
 *
 * Usage:
 *   import { withSpan } from "@repo/observability";
 *   const result = await withSpan("processUpload", async (span) => {
 *     span.setAttribute("file.size", bytes.length);
 *     return doWork();
 *   });
 */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

export { type Span, SpanStatusCode };
