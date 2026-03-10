import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTracer } from "./tracer";

describe("tracer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("creates spans with trace and span IDs", () => {
    const tracer = createTracer("test-service");
    const span = tracer.startSpan("test-operation");

    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.name).toBe("test-operation");

    span.end();
  });

  it("logs span start and end", () => {
    const infoSpy = vi.spyOn(console, "info");
    const debugSpy = vi.spyOn(console, "debug");

    const tracer = createTracer("test-service");
    const span = tracer.startSpan("my-op");
    span.setStatus("ok");
    span.end();

    // span_start logged at debug
    expect(debugSpy).toHaveBeenCalled();
    const startLog = JSON.parse(debugSpy.mock.calls[0][0] as string);
    expect(startLog.msg).toBe("span_start");
    expect(startLog.span).toBe("my-op");

    // span_end logged at info
    expect(infoSpy).toHaveBeenCalled();
    const endLog = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(endLog.msg).toBe("span_end");
    expect(endLog.status).toBe("ok");
    expect(endLog.duration_ms).toBeTypeOf("number");
  });

  it("startActiveSpan auto-ends on success", async () => {
    const infoSpy = vi.spyOn(console, "info");
    const tracer = createTracer("test");

    const result = await tracer.startActiveSpan("auto-op", async (span) => {
      span.setAttribute("custom", "value");
      return 42;
    });

    expect(result).toBe(42);
    const endLog = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(endLog.status).toBe("ok");
    expect(endLog.custom).toBe("value");
  });

  it("startActiveSpan auto-ends on error", async () => {
    const infoSpy = vi.spyOn(console, "info");
    const tracer = createTracer("test");

    await expect(
      tracer.startActiveSpan("fail-op", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const endLog = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(endLog.status).toBe("error");
    expect(endLog.statusMessage).toContain("boom");
  });
});
