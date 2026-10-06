import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadHostWithSettings() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const stored = new Map();
  const app = {
    name: "After Effects",
    version: "25.1",
    project: null,
    settings: {
      haveSetting(section, key) {
        return stored.has(`${section}:${key}`);
      },
      getSetting(section, key) {
        return stored.get(`${section}:${key}`);
      },
      saveSetting(section, key, value) {
        stored.set(`${section}:${key}`, value);
      }
    }
  };
  function FakeFile(path) {
    this.fsName = String(path ?? "");
    this.exists = true;
  }
  function FakeFolder(path) {
    this.fsName = String(path ?? "");
    this.exists = true;
  }
  FakeFolder.userData = { fsName: "C:/UserData" };
  FakeFolder.startup = { fsName: "C:/After Effects" };
  const dollar = { fileName: "C:/extension/host/index.jsx", global: {} };

  Function(
    "app",
    "File",
    "Folder",
    "$",
    "JSON",
    "decodeURIComponent",
    "encodeURIComponent",
    "CompItem",
    "Window",
    "LightType",
    source
  )(
    app,
    FakeFile,
    FakeFolder,
    dollar,
    JSON,
    decodeURIComponent,
    encodeURIComponent,
    function CompItem() {},
    function Window() {},
    {},
  );

  return dollar.global.NYAWORKS;
}

describe("text editor appearance host storage", () => {
  it("persists and returns a validated theme and language across CEP engines", async () => {
    const host = await loadHostWithSettings();
    const encoded = encodeURIComponent(JSON.stringify({
      themeId: "deep-emerald",
      languageId: "en"
    }));

    const writeResult = typeof host.setTextEditorAppearance === "function"
      ? JSON.parse(host.setTextEditorAppearance(encoded))
      : null;
    const readResult = typeof host.getTextEditorAppearance === "function"
      ? JSON.parse(host.getTextEditorAppearance())
      : null;

    expect(writeResult).toEqual({ ok: true });
    expect(readResult).toEqual({
      ok: true,
      appearance: { themeId: "deep-emerald", languageId: "en" }
    });
  });

  it("rejects unsupported appearance values instead of corrupting shared state", async () => {
    const host = await loadHostWithSettings();
    const encoded = encodeURIComponent(JSON.stringify({
      themeId: "light-theme",
      languageId: "xx"
    }));

    const result = typeof host.setTextEditorAppearance === "function"
      ? JSON.parse(host.setTextEditorAppearance(encoded))
      : null;

    expect(result).toEqual({ ok: false, reason: "invalid-appearance" });
  });
});
