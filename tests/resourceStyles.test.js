import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("resource browser accessibility styles", () => {
  it("keeps resource navigation adaptive and never autoplays preview media", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(css).toContain(".resources-page");
    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain(".resource-browser__navigation");
    expect(css).not.toMatch(/\.resource-preview-card video[^}]*autoplay/i);
  });
});
