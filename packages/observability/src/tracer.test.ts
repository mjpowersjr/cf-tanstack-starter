import { describe, expect, it } from "vitest";
import { getTracer, withSpan } from "./tracer";

describe("tracer", () => {
  it("returns a tracer instance", () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(tracer.startActiveSpan).toBeTypeOf("function");
    expect(tracer.startSpan).toBeTypeOf("function");
  });

  it("accepts a custom name", () => {
    const tracer = getTracer("custom-service");
    expect(tracer).toBeDefined();
  });

  it("withSpan returns the function result", async () => {
    const result = await withSpan("test-op", async (span) => {
      span.setAttribute("key", "value");
      return 42;
    });
    expect(result).toBe(42);
  });

  it("withSpan propagates errors", async () => {
    await expect(
      withSpan("fail-op", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
