/**
 * KV-backed feature flags.
 *
 * Flags are stored as simple key-value pairs in the FLAGS KV namespace.
 * Values: "true" = enabled, anything else (or missing) = disabled.
 *
 * Usage in a server function:
 *   const { env } = await import("cloudflare:workers");
 *   const isEnabled = await getFlag(env.FLAGS, "new-dashboard");
 */

export async function getFlag(kv: KVNamespace, flag: string): Promise<boolean> {
  const value = await kv.get(`flag:${flag}`);
  return value === "true";
}

export async function setFlag(kv: KVNamespace, flag: string, enabled: boolean): Promise<void> {
  await kv.put(`flag:${flag}`, enabled ? "true" : "false");
}

export async function deleteFlag(kv: KVNamespace, flag: string): Promise<void> {
  await kv.delete(`flag:${flag}`);
}

export async function listFlags(kv: KVNamespace): Promise<{ name: string; enabled: boolean }[]> {
  const list = await kv.list({ prefix: "flag:" });
  const flags: { name: string; enabled: boolean }[] = [];
  for (const key of list.keys) {
    const value = await kv.get(key.name);
    flags.push({
      name: key.name.replace("flag:", ""),
      enabled: value === "true",
    });
  }
  return flags;
}
