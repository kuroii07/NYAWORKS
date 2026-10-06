// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("global tooltip styles", () => {
  it("preserves explicit line breaks in multi-action tooltips", async () => {
    const style = document.createElement("style");
    style.textContent = await readFile("src/styles.css", "utf8");
    document.head.append(style);

    const tooltip = document.createElement("div");
    tooltip.className = "global-tooltip";
    document.body.append(tooltip);

    expect(getComputedStyle(tooltip).whiteSpace).toBe("pre-line");

    tooltip.remove();
    style.remove();
  });

  it("keeps single-line tooltips readable without expanding past their box", async () => {
    const style = document.createElement("style");
    style.textContent = await readFile("src/styles.css", "utf8");
    document.head.append(style);

    const tooltip = document.createElement("div");
    tooltip.className = "global-tooltip";
    tooltip.dataset.singleLine = "true";
    document.body.append(tooltip);

    const computed = getComputedStyle(tooltip);
    expect(computed.whiteSpace).toBe("nowrap");
    expect(computed.boxSizing).toBe("border-box");

    tooltip.remove();
    style.remove();
  });
});
