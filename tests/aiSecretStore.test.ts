import { describe, expect, it } from "vitest";
import { createMemoryAiSecretStore } from "../src/aiSettings/secretStore";

describe("AI secret store", () => {
  it("stores a key only in the supplied session store", async () => {
    const store = createMemoryAiSecretStore();
    const reference = await store.save("custom:one", "sk-secret");

    expect(store.persistence).toBe("session");
    expect(await store.has(reference)).toBe(true);
    expect(await store.readForRequest(reference)).toBe("sk-secret");

    await store.remove(reference);

    expect(await store.has(reference)).toBe(false);
    await expect(store.readForRequest(reference)).rejects.toThrow(
      "AI secret is unavailable"
    );
  });

  it("never exposes the secret through JSON serialization", async () => {
    const store = createMemoryAiSecretStore();
    await store.save("custom:one", "sk-secret");

    expect(JSON.stringify(store)).not.toContain("sk-secret");
  });

  it("replaces the previous secret reference for the same connection", async () => {
    const store = createMemoryAiSecretStore();
    const first = await store.save("custom:one", "first-secret");
    const second = await store.save("custom:one", "second-secret");

    expect(first).not.toBe(second);
    expect(await store.has(first)).toBe(false);
    expect(await store.readForRequest(second)).toBe("second-secret");
  });

  it("clears every session secret", async () => {
    const store = createMemoryAiSecretStore();
    const first = await store.save("custom:one", "first-secret");
    const second = await store.save("custom:two", "second-secret");

    await store.clear();

    expect(await store.has(first)).toBe(false);
    expect(await store.has(second)).toBe(false);
  });
});

