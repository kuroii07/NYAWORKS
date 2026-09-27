import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("global toast presentation", () => {
  it("keeps notifications out of page layout and gives them a compact themed surface", () => {
    expect(styles).toMatch(/\.toast-region\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?pointer-events:\s*none;/);
    expect(styles).toMatch(/\.toast-item\s*\{[\s\S]*?background:\s*var\(--nw-bg-elevated\);/);
    expect(styles).toMatch(/\.toast-item__close\s*\{[\s\S]*?cursor:\s*pointer;/);
    expect(styles).not.toContain("color-mix(");
  });

  it("mounts the toast provider around the whole extension shell", () => {
    expect(app).toContain("<ToastProvider>");
    expect(app).toContain("</ToastProvider>");
  });
});
