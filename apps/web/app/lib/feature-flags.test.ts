import { describe, expect, it } from "vitest";
import { deleteFlag, getFlag, listFlags, setFlag } from "./feature-flags";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async ({ prefix }: { prefix?: string } = {}) => {
      const keys = [...store.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  } as unknown as KVNamespace;
}

describe("feature-flags", () => {
  it("returns false for missing flags", async () => {
    const kv = createMockKV();
    expect(await getFlag(kv, "nonexistent")).toBe(false);
  });

  it("sets and gets a flag", async () => {
    const kv = createMockKV();
    await setFlag(kv, "test-flag", true);
    expect(await getFlag(kv, "test-flag")).toBe(true);
    await setFlag(kv, "test-flag", false);
    expect(await getFlag(kv, "test-flag")).toBe(false);
  });

  it("deletes a flag", async () => {
    const kv = createMockKV();
    await setFlag(kv, "to-delete", true);
    expect(await getFlag(kv, "to-delete")).toBe(true);
    await deleteFlag(kv, "to-delete");
    expect(await getFlag(kv, "to-delete")).toBe(false);
  });

  it("lists all flags", async () => {
    const kv = createMockKV();
    await setFlag(kv, "flag-a", true);
    await setFlag(kv, "flag-b", false);
    const flags = await listFlags(kv);
    expect(flags).toHaveLength(2);
    expect(flags).toContainEqual({ name: "flag-a", enabled: true });
    expect(flags).toContainEqual({ name: "flag-b", enabled: false });
  });
});
