import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("global search styles", () => {
  it("keeps the result panel absolute and independently scrollable", () => {
    expect(css).toMatch(/\.global-search-results\s*\{[^}]*position:\s*absolute/s);
    expect(css).toMatch(/\.global-search-results\s*\{[^}]*max-height:/s);
    expect(css).toMatch(/\.global-search-results\s*\{[^}]*overflow-y:\s*auto/s);
  });

  it("keeps search and result rows on shared visual tokens", () => {
    expect(css).toContain(".global-search-result-row");
    expect(css).toContain("var(--nw-bg-elevated)");
    expect(css).toContain("var(--nw-accent)");
  });
});
