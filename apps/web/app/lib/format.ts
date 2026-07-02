export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable session device string from a User-Agent header. */
export function formatUserAgent(ua: string | null, maxLength = 80): string {
  if (!ua) return "Unknown device";
  return ua.length > maxLength ? `${ua.slice(0, maxLength)}…` : ua;
}

/**
 * Render a timestamp in the viewer's locale and timezone.
 * Accepts Date (drizzle timestamp columns) or an ISO/epoch value.
 */
export function formatDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
