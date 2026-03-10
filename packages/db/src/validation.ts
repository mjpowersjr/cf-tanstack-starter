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

export const UploadFileSchema = v.object({
  filename: v.pipe(v.string(), v.minLength(1, "Filename is required"), v.maxLength(255)),
  contentType: v.pipe(v.string(), v.minLength(1)),
  base64: v.pipe(v.string(), v.minLength(1, "File content is required")),
});

export type UploadFileInput = v.InferOutput<typeof UploadFileSchema>;
