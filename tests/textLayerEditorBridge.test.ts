import { describe, expect, it, vi } from "vitest";
import { createTextLayerEditorBridge } from "../src/host/textLayerEditorBridge";

describe("text layer editor bridge", () => {
  it("reads the selected text layer through the shared Host API", async () => {
    const evalScript = vi.fn((_script: string, callback: (value: string) => void) => {
      callback(JSON.stringify({
        ok: true,
        text: "中文内容",
        layerName: "中文内容",
        targetId: "target-1"
      }));
    });
    const bridge = createTextLayerEditorBridge({ __adobe_cep__: { evalScript } });

    await expect(bridge.readSelectedTextLayer()).resolves.toEqual({
      ok: true,
      text: "中文内容",
      layerName: "中文内容",
      targetId: "target-1"
    });
    expect(evalScript).toHaveBeenCalledWith(
      "NYAWORKS.readSelectedTextLayer()",
      expect.any(Function)
    );
  });

  it("safely encodes multilingual text for Apply and Create", async () => {
    const scripts: string[] = [];
    const evalScript = vi.fn((script: string, callback: (value: string) => void) => {
      scripts.push(script);
      callback(JSON.stringify({ ok: true, createdLayers: 0, updatedLayers: 1 }));
    });
    const bridge = createTextLayerEditorBridge({ __adobe_cep__: { evalScript } });

    await bridge.applyText("target-1", "中文\n日本語 한글");
    await bridge.createText("中文\n日本語 한글");

    expect(scripts[0]).toContain(encodeURIComponent(JSON.stringify({
      targetId: "target-1",
      text: "中文\n日本語 한글"
    })));
    expect(scripts[1]).toContain(encodeURIComponent(JSON.stringify({
      text: "中文\n日本語 한글"
    })));
  });
});
