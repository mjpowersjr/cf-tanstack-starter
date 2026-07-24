import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./index";

describe("logger (pino browser build)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs structured JSON to console", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    logger.info("test message");

    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.msg).toBe("test message");
    expect(output.level).toBe(30); // info = 30
    expect(output.time).toBeTypeOf("number");
  });

  it("respects log levels", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    logger.debug("should not appear");
    expect(spy).not.toHaveBeenCalled();
  });

  it("supports runtime level changes", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    logger.debug("hidden");
    expect(spy).not.toHaveBeenCalled();

    logger.level = "debug";
    logger.debug("visible");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("includes bindings in output", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger({
      level: "info",
      bindings: { service: "test" },
    });

    logger.info("hello");

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.service).toBe("test");
  });

  it("creates child loggers with merged bindings", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const parent = createLogger({
      level: "info",
      bindings: { service: "parent" },
    });
    const child = parent.child({ requestId: "abc-123" });

    child.info("child message");

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.service).toBe("parent");
    expect(output.requestId).toBe("abc-123");
  });

  it("merges obj-first extras into the entry", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    logger.info({ userId: 42 }, "with extras");

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.msg).toBe("with extras");
    expect(output.userId).toBe(42);
  });

  it("serializes Error values under the err key with message and stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    logger.error({ err: new Error("boom") }, "failed");

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.err.msg).toBe("boom");
    expect(output.err.stack).toContain("boom");
  });

  it("does not throw on circular structures", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => logger.info({ circular }, "circular")).not.toThrow();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.logError).toBe("unserializable log entry");
  });

  it("invokes onEntry for each written entry", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const entries: Record<string, unknown>[] = [];
    const logger = createLogger({ level: "info", onEntry: (e) => entries.push(e) });

    logger.info({ a: 1 }, "first");
    logger.info("second");

    expect(entries).toHaveLength(2);
    expect(entries[0].msg).toBe("first");
    expect(entries[0].a).toBe(1);
    expect(entries[1].msg).toBe("second");
  });
});
