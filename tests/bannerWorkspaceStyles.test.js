import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("Banner workspace styles", () => {
  it("keeps the banner tool state at a stable height", () => {
    expect(css).toMatch(/\.home-banner\s*\{[^}]*min-height:/s);
    expect(css).toMatch(/\.banner-tool-workspace\s*\{[^}]*min-height:/s);
  });

  it("uses a compact context menu and shared tokens", () => {
    expect(css).toContain(".banner-tool-menu");
    expect(css).toContain("var(--nw-bg-elevated)");
    expect(css).toContain("var(--nw-accent)");
  });
});
