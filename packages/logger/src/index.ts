/**
 * Pino-compatible structured logger for Cloudflare Workers.
 *
 * Pino's full runtime depends on Node.js streams and worker_threads, which are
 * unavailable in the Workers runtime. This module provides a pino-compatible API
 * (levels, child loggers, structured JSON) that works natively with Cloudflare's
 * Workers Logs and OpenTelemetry-compatible observability pipeline.
 *
 * Output is JSON to stdout via console.*, which Cloudflare automatically ingests
 * with field extraction and filtering support.
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export interface LogFn {
  (msg: string, extra?: Record<string, unknown>): void;
  (extra: Record<string, unknown>, msg: string): void;
}

export interface Logger {
  level: LogLevel;
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
}

function createLogFn(
  level: LogLevel,
  minLevel: LogLevel,
  bindings: Record<string, unknown>,
): LogFn {
  const levelValue = LEVELS[level];
  const minLevelValue = LEVELS[minLevel];

  return (...args: [unknown, unknown?]) => {
    if (levelValue < minLevelValue) return;

    let msg: string;
    let extra: Record<string, unknown> | undefined;

    if (typeof args[0] === "string") {
      msg = args[0];
      extra = args[1] as Record<string, unknown> | undefined;
    } else {
      extra = args[0] as Record<string, unknown>;
      msg = args[1] as string;
    }

    const entry = {
      level: levelValue,
      time: Date.now(),
      msg,
      ...bindings,
      ...extra,
    };

    const method = level === "fatal" ? "error" : level === "trace" ? "debug" : level;
    // eslint-disable-next-line no-console
    console[method](JSON.stringify(entry));
  };
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const bindings = options.bindings ?? {};

  return {
    level,
    trace: createLogFn("trace", level, bindings),
    debug: createLogFn("debug", level, bindings),
    info: createLogFn("info", level, bindings),
    warn: createLogFn("warn", level, bindings),
    error: createLogFn("error", level, bindings),
    fatal: createLogFn("fatal", level, bindings),
    child(childBindings: Record<string, unknown>) {
      return createLogger({
        level,
        bindings: { ...bindings, ...childBindings },
      });
    },
  };
}

/** Default logger instance */
export const logger = createLogger();
