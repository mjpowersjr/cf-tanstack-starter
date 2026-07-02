/**
 * Structured logger for Cloudflare Workers, backed by pino.
 *
 * Pino's Node build needs streams/worker_threads, which the Workers runtime
 * doesn't provide — so this uses pino's browser build (imported explicitly as
 * `pino/browser.js`), which logs through console.*. Cloudflare Workers Logs
 * ingests that JSON with field extraction. The same build runs under vitest,
 * so tests exercise the production code path.
 *
 * Call convention is pino's: `log.info({ userId }, "signed in")` — object
 * first, message second. Error objects passed under the `err` key are
 * serialized with message/stack/name via pino's standard serializers.
 */
/// <reference path="./pino-browser.d.ts" />
import pinoFactory from "pino/browser.js";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogFn {
  (obj: Record<string, unknown> | Error, msg?: string, ...args: unknown[]): void;
  (msg: string, ...args: unknown[]): void;
}

export interface Logger {
  level: string;
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  child(bindings: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  bindings?: Record<string, unknown>;
  /**
   * Observe each structured log entry in addition to console output — e.g.
   * the job runner buffers a run's logs into its job_runs row.
   */
  onEntry?: (entry: Record<string, unknown>) => void;
}

const CONSOLE_METHOD: Record<number, "debug" | "info" | "warn" | "error"> = {
  10: "debug",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "error",
};

export function createLogger(options: LoggerOptions = {}): Logger {
  const root = pinoFactory({
    level: options.level ?? "info",
    // Error values (under `err` or as the first argument) become plain
    // {type, msg, stack} objects — Error properties are non-enumerable and
    // would otherwise JSON.stringify to `{}`.
    serializers: { err: pinoFactory.stdSerializers.err },
    browser: {
      asObject: true,
      serialize: true,
      write: (o: object) => {
        const entry = o as Record<string, unknown> & { level?: number };
        options.onEntry?.(entry);
        const method = CONSOLE_METHOD[entry.level ?? 30] ?? "info";
        let line: string;
        try {
          line = JSON.stringify(entry);
        } catch {
          // Circular structure — a diagnostic log call must never crash the
          // request it observes.
          line = JSON.stringify({
            level: entry.level,
            time: entry.time,
            msg: String(entry.msg),
            logError: "unserializable log entry",
          });
        }
        console[method](line);
      },
    },
  });
  const logger = options.bindings ? root.child(options.bindings) : root;
  return logger as unknown as Logger;
}

/** Default logger instance */
export const logger = createLogger();
