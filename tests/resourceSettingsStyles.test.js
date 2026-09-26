import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("resource settings visual system", () => {
  it("styles settings rows and the browser with tokens, status states, focus states, and a narrow layout", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(css).toContain(".resource-settings");
    expect(css).toContain(".resource-source-row");
    expect(css).toContain("[data-status=\"missing\"]");
    expect(css).toContain("[data-status=\"error\"]");
    expect(css).toContain(".resource-source-row__summary:focus-visible");
    expect(css).toContain("var(--nw-accent)");
    expect(css).toContain(".resource-preview-card img");
    expect(css).toContain("object-fit: cover");
    expect(css).toContain("@media (max-width: 520px)");
  });
});
