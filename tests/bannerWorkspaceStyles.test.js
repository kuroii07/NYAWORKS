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

  it("keeps the shell and tool panel aligned across density presets", () => {
    expect(css).toMatch(/\[data-density="medium"\] \.banner-tool-workspace[\s\S]*?min-height:\s*94px/);
    expect(css).toMatch(/\[data-density="small"\] \.banner-tool-workspace[\s\S]*?min-height:\s*78px/);

    const shellRule = css.match(/\.banner-workspace-shell\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(shellRule).not.toMatch(/min-height\s*:/);
  });
});
