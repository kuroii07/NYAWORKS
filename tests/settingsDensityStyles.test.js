import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("settings density corner radii", () => {
  it("keeps the settings tab frame aligned with its inner buttons at every density", () => {
    expect(styles).toMatch(
      /\.settings-tabs\s*\{[\s\S]*?border-radius:\s*13px;/
    );
    expect(styles).toMatch(
      /\[data-density="medium"\] \.settings-tabs\s*\{[\s\S]*?border-radius:\s*11px;/
    );
    expect(styles).toMatch(
      /\[data-density="small"\] \.settings-tabs\s*\{[\s\S]*?border-radius:\s*9px;/
    );
  });

  it("renders the brightness slider track without a visible outer border", () => {
    expect(styles).toMatch(
      /\.brightness-control input\s*\{[\s\S]*?appearance:\s*none;/
    );
    expect(styles).toMatch(
      /\.brightness-control input::-webkit-slider-runnable-track\s*\{[\s\S]*?border:\s*0;[\s\S]*?linear-gradient\([\s\S]*?var\(--brightness-progress\)/
    );
    expect(styles).toMatch(
      /\.brightness-control input::-moz-range-track\s*\{[\s\S]*?border:\s*0;/
    );
    expect(styles).toMatch(
      /\.brightness-control input::-moz-range-progress\s*\{[\s\S]*?background:\s*var\(--nw-accent\);/
    );
  });
});
