import { describe, expect, it } from "vitest";

describe("text editor appearance bridge", () => {
  it("writes encoded appearance and reads validated host state", async () => {
    const modulePath = "../src/host/textEditorAppearanceBridge";
    const bridgeModule = await import(modulePath).catch(() => null);
    expect(bridgeModule).not.toBeNull();
    if (!bridgeModule) return;

    let stored: { themeId: string; languageId: string } | null = null;
    const environment = {
      __adobe_cep__: {
        evalScript(script: string, callback: (result: string) => void) {
          if (script.startsWith("NYAWORKS.setTextEditorAppearance(")) {
            const encoded = JSON.parse(
              script.slice(
                "NYAWORKS.setTextEditorAppearance(".length,
                -1
              )
            ) as string;
            stored = JSON.parse(decodeURIComponent(encoded));
            callback(JSON.stringify({ ok: true }));
            return;
          }
          callback(JSON.stringify({ ok: true, appearance: stored }));
        }
      }
    };
    const bridge = bridgeModule.createTextEditorAppearanceBridge(environment);

    expect(await bridge.writeAppearance({
      themeId: "deep-emerald",
      languageId: "en"
    })).toBe(true);
    expect(await bridge.readAppearance()).toEqual({
      themeId: "deep-emerald",
      languageId: "en"
    });
  });

  it("ignores malformed or unsupported host appearance values", async () => {
    const modulePath = "../src/host/textEditorAppearanceBridge";
    const bridgeModule = await import(modulePath).catch(() => null);
    expect(bridgeModule).not.toBeNull();
    if (!bridgeModule) return;

    const environment = {
      __adobe_cep__: {
        evalScript(_script: string, callback: (result: string) => void) {
          callback(JSON.stringify({
            ok: true,
            appearance: { themeId: "light-theme", languageId: "xx" }
          }));
        }
      }
    };
    const bridge = bridgeModule.createTextEditorAppearanceBridge(environment);

    expect(await bridge.readAppearance()).toBeNull();
  });
});
