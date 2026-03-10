/**
 * Valibot schemas for input validation.
 *
 * Uses Standard Schema (`~standard` protocol), which TanStack Start's
 * `inputValidator` natively supports — no adapter code needed.
 *
 * Valibot is ~1KB vs Zod's ~14KB (minified+gzipped) due to its
 * tree-shakable modular design, making it ideal for Workers.
 */
import * as v from "valibot";

export const AddEntrySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, "Name is required"), v.maxLength(100)),
  message: v.pipe(v.string(), v.trim(), v.minLength(1, "Message is required"), v.maxLength(2000)),
});

export type AddEntryInput = v.InferOutput<typeof AddEntrySchema>;

/** Max file size: 5MB (base64 encodes ~33% larger, so limit base64 string accordingly) */
const MAX_BASE64_LENGTH = Math.ceil((5 * 1024 * 1024 * 4) / 3);

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
] as const;

export const UploadFileSchema = v.object({
  filename: v.pipe(v.string(), v.minLength(1, "Filename is required"), v.maxLength(255)),
  contentType: v.pipe(
    v.string(),
    v.minLength(1),
    v.check(
      (val) => (ALLOWED_CONTENT_TYPES as readonly string[]).includes(val),
      `Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
    ),
  ),
  base64: v.pipe(
    v.string(),
    v.minLength(1, "File content is required"),
    v.maxLength(MAX_BASE64_LENGTH, "File size must not exceed 5MB"),
  ),
});

export type UploadFileInput = v.InferOutput<typeof UploadFileSchema>;
