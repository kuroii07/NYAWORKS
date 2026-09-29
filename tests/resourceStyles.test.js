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

  it("keeps resource header and row actions horizontal in narrow panels", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.resources-page__header \{ align-items: center; flex-direction: row;/);
    expect(css).toMatch(/\.resource-list-row \{ align-items: center; flex-wrap: nowrap;/);
    expect(css).toMatch(/\.resource-list-row__actions \{ width: auto; flex: 0 0 auto;/);
  });

  it("gives the resources page its own vertical scroll surface", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/.resources-page\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/.resources-page\s*\{[^}]*min-height:\s*0/s);
  });
});
