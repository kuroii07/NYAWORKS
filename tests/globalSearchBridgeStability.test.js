import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("GlobalSearchProvider bridge stability", () => {
  it("uses the module-level host bridge instead of creating one per render", async () => {
    const source = await readFile("src/search/GlobalSearchProvider.tsx", "utf8");

    expect(source).toContain("bridge = globalSearchHostBridge");
    expect(source).not.toContain("bridge = createGlobalSearchHostBridge()");
  });
});
