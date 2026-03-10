import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "./index";

describe("logger", () => {
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

  it("supports extra fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    logger.info("with extras", { userId: 42 });

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.msg).toBe("with extras");
    expect(output.userId).toBe(42);
  });

  it("supports pino-style obj-first signature", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger({ level: "info" });

    logger.info({ userId: 42 }, "with extras");

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.msg).toBe("with extras");
    expect(output.userId).toBe(42);
  });
});
