import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { AddEntrySchema, UploadFileSchema } from "./validation";

describe("AddEntrySchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(AddEntrySchema, {
      name: "Alice",
      message: "Hello world",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.name).toBe("Alice");
    }
  });

  it("trims whitespace", () => {
    const result = v.safeParse(AddEntrySchema, {
      name: "  Alice  ",
      message: "  Hello  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.name).toBe("Alice");
      expect(result.output.message).toBe("Hello");
    }
  });

  it("rejects empty name", () => {
    const result = v.safeParse(AddEntrySchema, {
      name: "",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty message", () => {
    const result = v.safeParse(AddEntrySchema, {
      name: "Alice",
      message: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = v.safeParse(AddEntrySchema, {
      name: "x".repeat(101),
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("UploadFileSchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(UploadFileSchema, {
      filename: "test.txt",
      contentType: "text/plain",
      base64: "SGVsbG8=",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty filename", () => {
    const result = v.safeParse(UploadFileSchema, {
      filename: "",
      contentType: "text/plain",
      base64: "SGVsbG8=",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing base64", () => {
    const result = v.safeParse(UploadFileSchema, {
      filename: "test.txt",
      contentType: "text/plain",
      base64: "",
    });
    expect(result.success).toBe(false);
  });
});
