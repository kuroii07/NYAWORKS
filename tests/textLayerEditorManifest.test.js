import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

describe("text layer editor CEP contract", () => {
  it("declares a dedicated modeless HTML entry", () => {
    const manifest = readFileSync("public/CSXS/manifest.xml", "utf8");
    const document = new JSDOM(manifest, { contentType: "text/xml" }).window.document;
    const editor = document.querySelector(
      'DispatchInfoList > Extension[Id="com.kuroii.nyaworks.text-editor"]'
    );
    expect(editor?.querySelector("UI > Type")?.textContent).toBe("Modeless");
    expect(editor?.querySelector("Resources > MainPath")?.textContent).toBe(
      "./text-layer-editor.html"
    );
    expect(editor?.querySelector("Lifecycle > AutoVisible")?.textContent).toBe("true");
    expect(editor?.querySelector("UI > Menu")).toBe(null);
  });

  it("builds the editor from its own Vite HTML entry", () => {
    const config = readFileSync("vite.config.ts", "utf8");
    expect(config).toContain('"text-layer-editor.html"');
  });

  it("uses NYAWORKS theme tokens and a custom compact scrollbar", () => {
    const styles = readFileSync("src/textLayerEditor/styles.css", "utf8");
    expect(styles).toContain("var(--nw-bg");
    expect(styles).toContain("var(--nw-accent)");
    expect(styles).toContain("*::-webkit-scrollbar");
    expect(styles).toContain("border-radius: 999px");
    expect(styles).toContain("height: 26px");
  });
});
