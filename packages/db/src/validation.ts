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

/** Max upload size in bytes. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Max file size: 5MB (base64 encodes ~33% larger, so limit base64 string accordingly) */
const MAX_BASE64_LENGTH = Math.ceil((MAX_FILE_SIZE * 4) / 3);

// SVG is allowed only because the download route forces `Content-Disposition:
// attachment` for script-capable types — never serve these inline.
export const ALLOWED_CONTENT_TYPES = [
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
  filename: v.pipe(
    v.string(),
    v.minLength(1, "Filename is required"),
    v.maxLength(255),
    v.regex(
      // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
      /^[^/\\\x00-\x1f]+$/,
      "Filename must not contain path separators or control characters",
    ),
    v.check((val) => val !== "." && val !== "..", "Invalid filename"),
  ),
  contentType: v.picklist(
    ALLOWED_CONTENT_TYPES,
    `Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
  ),
  base64: v.pipe(
    v.string(),
    v.minLength(1, "File content is required"),
    v.maxLength(MAX_BASE64_LENGTH, "File size must not exceed 5MB"),
    v.base64("File content must be valid base64"),
  ),
});

export type UploadFileInput = v.InferOutput<typeof UploadFileSchema>;

export const FileIdSchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1, "File ID is required")),
});

export type FileIdInput = v.InferOutput<typeof FileIdSchema>;

export const TriggerJobSchema = v.object({
  jobName: v.pipe(v.string(), v.minLength(1, "Job name is required")),
});

export type TriggerJobInput = v.InferOutput<typeof TriggerJobSchema>;

export const EntryIdSchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1, "Entry ID is required")),
});

export type EntryIdInput = v.InferOutput<typeof EntryIdSchema>;

export const UpdateEntrySchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  name: v.pipe(v.string(), v.trim(), v.minLength(1, "Name is required"), v.maxLength(100)),
  message: v.pipe(v.string(), v.trim(), v.minLength(1, "Message is required"), v.maxLength(2000)),
});

export type UpdateEntryInput = v.InferOutput<typeof UpdateEntrySchema>;

// --- Admin: user management ---

/** Roles the admin UI can assign. Mirrors better-auth's admin plugin roles. */
export const USER_ROLES = ["user", "admin"] as const;

const userRole = v.picklist(USER_ROLES, "Role must be 'user' or 'admin'");
const usernameField = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(3, "Username must be at least 3 characters"),
  v.maxLength(50),
  v.regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, dashes, underscores"),
);
const emailField = v.pipe(v.string(), v.trim(), v.email("Enter a valid email"), v.maxLength(255));
const passwordField = v.pipe(
  v.string(),
  v.minLength(8, "Password must be at least 8 characters"),
  v.maxLength(256),
);
const userIdField = v.pipe(v.string(), v.minLength(1, "User ID is required"));

/** Paginated + searchable user listing input. */
export const ListUsersSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  search: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(255)), ""),
});

export type ListUsersInput = v.InferOutput<typeof ListUsersSchema>;

export const CreateUserSchema = v.object({
  username: usernameField,
  email: emailField,
  password: passwordField,
  role: v.optional(userRole, "user"),
});

export type CreateUserInput = v.InferOutput<typeof CreateUserSchema>;

export const UpdateUserSchema = v.object({
  userId: userIdField,
  username: usernameField,
  email: emailField,
});

export type UpdateUserInput = v.InferOutput<typeof UpdateUserSchema>;

export const SetRoleSchema = v.object({
  userId: userIdField,
  role: userRole,
});

export type SetRoleInput = v.InferOutput<typeof SetRoleSchema>;

export const ResetPasswordSchema = v.object({
  userId: userIdField,
  password: passwordField,
});

export type ResetPasswordInput = v.InferOutput<typeof ResetPasswordSchema>;

export const UserIdSchema = v.object({
  userId: userIdField,
});

export type UserIdInput = v.InferOutput<typeof UserIdSchema>;
