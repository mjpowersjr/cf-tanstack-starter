import { createLogger, type Logger } from "@repo/logger";

export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
}

export interface Span {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: "ok" | "error", message?: string): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, options?: SpanOptions): Span;
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T | Promise<T>,
  ): Promise<T>;
  startActiveSpan<T>(
    name: string,
    options: SpanOptions,
    fn: (span: Span) => T | Promise<T>,
  ): Promise<T>;
}

function generateId(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function createSpan(
  logger: Logger,
  traceId: string,
  name: string,
  options?: SpanOptions,
): Span {
  const spanId = generateId(8);
  const startTime = performance.now();
  const attributes: Record<string, string | number | boolean> = {
    ...options?.attributes,
  };
  let status: "ok" | "error" | "unset" = "unset";
  let statusMessage: string | undefined;

  logger.debug("span_start", {
    traceId,
    spanId,
    span: name,
    timestamp: Date.now(),
  });

  return {
    traceId,
    spanId,
    name,
    startTime,

    setAttribute(key, value) {
      attributes[key] = value;
    },

    setStatus(s, message) {
      status = s;
      statusMessage = message;
    },

    end() {
      const duration = performance.now() - startTime;
      logger.info("span_end", {
        traceId,
        spanId,
        span: name,
        duration_ms: Math.round(duration * 100) / 100,
        status,
        ...(statusMessage ? { statusMessage } : {}),
        ...attributes,
      });
    },
  };
}

export function createTracer(serviceName: string): Tracer {
  const log = createLogger({
    level: "debug",
    bindings: { service: serviceName },
  });

  return {
    startSpan(name: string, options?: SpanOptions): Span {
      const traceId = generateId(16);
      return createSpan(log, traceId, name, options);
    },

    async startActiveSpan<T>(
      name: string,
      optionsOrFn: SpanOptions | ((span: Span) => T | Promise<T>),
      maybeFn?: (span: Span) => T | Promise<T>,
    ): Promise<T> {
      const fn = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn!;
      const options = typeof optionsOrFn === "function" ? undefined : optionsOrFn;
      const traceId = generateId(16);
      const span = createSpan(log, traceId, name, options);

      try {
        const result = await fn(span);
        if (span.name) {
          span.setStatus("ok");
          span.end();
        }
        return result;
      } catch (error) {
        span.setStatus("error", String(error));
        span.end();
        throw error;
      }
    },
  };
}
