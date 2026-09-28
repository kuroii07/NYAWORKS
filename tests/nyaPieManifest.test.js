import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const manifestPath = new URL("../public/CSXS/manifest.xml", import.meta.url);

describe("Nya Pie P0 CEP manifest", () => {
  it("declares the panel and modeless runtime in the same bundle", () => {
    const manifest = readFileSync(manifestPath, "utf8");
    const document = new JSDOM(manifest, {
      contentType: "text/xml"
    }).window.document;
    const root = document.documentElement;
    const ids = Array.from(
      document.querySelectorAll("ExtensionList > Extension")
    ).map((node) => node.getAttribute("Id"));
    const runtime = document.querySelector(
      'DispatchInfoList > Extension[Id="com.kuroii.nyaworks.nyapie.p0"]'
    );

    expect(root.getAttribute("ExtensionBundleId")).toBe(
      "com.kuroii.nyaworks"
    );
    expect(ids).toEqual([
      "com.kuroii.nyaworks.panel",
      "com.kuroii.nyaworks.nyapie.p0"
    ]);
    expect(runtime?.querySelector("UI > Type")?.textContent).toBe("Modeless");
    expect(runtime?.querySelector("Resources > MainPath")?.textContent).toBe(
      "./nya-pie-runtime.html"
    );
  });

  it("keeps the approved main panel size unchanged", () => {
    const manifest = readFileSync(manifestPath, "utf8");
    const document = new JSDOM(manifest, {
      contentType: "text/xml"
    }).window.document;
    const panel = document.querySelector(
      'DispatchInfoList > Extension[Id="com.kuroii.nyaworks.panel"]'
    );

    expect(panel?.querySelector("UI > Type")?.textContent).toBe("Panel");
    expect(panel?.querySelector("Geometry > Size > Width")?.textContent).toBe(
      "520"
    );
    expect(panel?.querySelector("Geometry > Size > Height")?.textContent).toBe(
      "960"
    );
  });
});
