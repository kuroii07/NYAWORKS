import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("CEP scrollbar styling", () => {
  it("uses a compact themed Chromium scrollbar instead of the system default", () => {
    expect(styles).toMatch(/\*::-webkit-scrollbar\s*\{[\s\S]*?width:\s*6px;[\s\S]*?height:\s*6px;/);
    expect(styles).toMatch(
      /\*::-webkit-scrollbar-thumb\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*var\(--nw-border-strong\);/
    );
    expect(styles).toMatch(
      /\*::-webkit-scrollbar-thumb:hover\s*\{[\s\S]*?background:\s*var\(--nw-accent\);/
    );
  });

  it("keeps the tool picker scrollbar aligned with the global compact treatment", () => {
    expect(styles).toMatch(
      /\.home-tool-picker__grid::-webkit-scrollbar\s*\{[\s\S]*?width:\s*6px;/
    );
    expect(styles).toMatch(
      /\.home-tool-picker__grid::-webkit-scrollbar-track\s*\{[\s\S]*?background:\s*transparent;/
    );
  });
});
