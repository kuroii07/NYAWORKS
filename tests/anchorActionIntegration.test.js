import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("anchor action integration", () => {
  it("keeps HomePage behind the shared action service boundary", async () => {
    const source = await readFile("src/pages/HomePage.tsx", "utf8");

    expect(source).toContain("useActionService");
    expect(source).toContain("getAnchorActionId(position)");
    expect(source).not.toContain("anchorHostBridge");
    expect(source).not.toContain("../host/anchorBridge");
  });

  it("provides the shared action service outside global search", async () => {
    const source = await readFile("src/main.tsx", "utf8");
    const actionProvider = source.indexOf("<ActionServiceProvider>");
    const searchProvider = source.indexOf("<GlobalSearchProvider");

    expect(actionProvider).toBeGreaterThan(-1);
    expect(searchProvider).toBeGreaterThan(actionProvider);
  });

  it("keeps action definitions independent from the host bridge", async () => {
    const source = await readFile("src/actions/definitions/anchorActions.ts", "utf8");

    expect(source).not.toContain("/host/");
    expect(source).not.toContain("anchorBridge");
  });
});
