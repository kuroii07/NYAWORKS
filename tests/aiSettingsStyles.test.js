import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(
  path.resolve(process.cwd(), "src/styles.css"),
  "utf8"
);
const modelComboBox = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/ModelComboBox.tsx"),
  "utf8"
);

describe("AI settings styles", () => {
  it("uses a compact four-column provider grid with a two-column fallback", () => {
    expect(css).toMatch(
      /\.ai-provider-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(css).toMatch(
      /@media \(max-width:\s*520px\)[\s\S]*?\.ai-provider-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
  });

  it("keeps AI surfaces on shared theme variables", () => {
    const aiStyles =
      css.match(/\.settings-ai[\s\S]*?(?=\n\.global-tooltip|\n\[data-motion)/)?.[0] ??
      "";

    expect(aiStyles).toContain("var(--nw-bg-elevated)");
    expect(aiStyles).toContain("var(--nw-accent)");
    expect(aiStyles).not.toMatch(/background:\s*(white|#fff(?:fff)?)/i);
  });

  it("bounds custom selects and model popovers", () => {
    expect(css).toMatch(
      /\.ai-custom-selector[\s\S]*?min-width:\s*0[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/s
    );
    expect(css).toMatch(
      /\.model-combobox__popover\s*\{[\s\S]*?position:\s*fixed/s
    );
    expect(modelComboBox).toContain(
      "viewportWidth - VIEWPORT_PADDING * 2"
    );
  });

  it("defines medium and small density tuning for the AI page", () => {
    expect(css).toContain('[data-density="medium"] .settings-ai');
    expect(css).toContain('[data-density="small"] .settings-ai');
  });

  it("does not collapse the custom connection selector in compact densities", () => {
    expect(css).toContain(
      '[data-density="medium"] .ai-custom-selector button:not(.setting-select)'
    );
    expect(css).toContain(
      '[data-density="small"] .ai-custom-selector button:not(.setting-select)'
    );
    expect(css).not.toContain(
      '[data-density="medium"] .ai-custom-selector button {'
    );
    expect(css).not.toContain(
      '[data-density="small"] .ai-custom-selector button {'
    );
    expect(css).not.toContain(".ai-custom-selector button {");
  });

  it("clips long connection names inside the section heading", () => {
    expect(css).toMatch(
      /\.ai-settings-section h2 > span\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s
    );
  });
});
