import { describe, expect, it } from "vitest";
import { createLayerHostBridge } from "../src/host/layerBridge";
import { getLayerDisplayName } from "../src/layers/layerDisplayNames";
import { resolveLayerLanguage } from "../src/layers/layerLanguage";
import { LANGUAGE_IDS } from "../src/i18n/languages";

describe("ordinary object display catalog", () => {
  const baseline = [
    ["text", ["text", "text", "text", "text", "text"]],
    ["solid", ["Nya 纯色", "Nya 純色", "Nya Solid", "Nya 平面", "Nya 단색"]],
    ["shape", ["Nya 圆角矩形", "Nya 圓角矩形", "Nya Rounded Rectangle", "Nya 角丸長方形", "Nya 둥근 사각형"]],
    ["adjustment", ["Nya 调整层", "Nya 調整圖層", "Nya Adjustment", "Nya 調整レイヤー", "Nya 조정 레이어"]],
    ["null", ["Nya 控制", "Nya 控制", "Nya Control", "Nya コントロール", "Nya 컨트롤"]],
    ["camera", ["Nya 摄像机", "Nya 攝影機", "Nya Camera", "Nya カメラ", "Nya 카메라"]],
    ["cameraController", ["Nya 摄像机控制", "Nya 攝影機控制", "Nya Camera Control", "Nya カメラコントロール", "Nya 카메라 컨트롤"]],
    ["light", ["Nya 灯光", "Nya 燈光", "Nya Light", "Nya ライト", "Nya 조명"]],
    ["precompose", ["Precomp", "預合成", "Precomp", "プリコンポーズ", "사전 구성"]],
    ["unprecompose", ["解预合成", "解預合成", "Unprecompose", "プリコンポーズを解除", "사전 구성 해제"]]
  ] as const;
  it.each(baseline)("resolves %s names with a frozen Chinese default", (objectId, names) => {
    expect(getLayerDisplayName(objectId)).toBe(names[0]);
    LANGUAGE_IDS.forEach((languageId, index) => {
      expect(getLayerDisplayName(objectId, languageId)).toBe(names[index]);
    });
  });
  it("rejects unknown object IDs instead of using inherited object properties", () => {
    for (const objectId of ["constructor", "__proto__", "unknown"]) {
      expect(() => getLayerDisplayName(objectId as never)).toThrow("unknown-layer-object");
    }
  });
  it("defaults malformed languages and preserves the five exact locale IDs", () => {
    for (const invalid of [undefined, null, 42, {}, [], "en-US", "EN", "constructor", "__proto__"]) {
      expect(resolveLayerLanguage(invalid)).toBe("zh-CN");
      expect(getLayerDisplayName("adjustment", invalid)).toBe("Nya 调整层");
    }
    LANGUAGE_IDS.forEach(languageId => expect(resolveLayerLanguage(languageId)).toBe(languageId));
  });
});

describe("optional layer language Bridge contract", () => {
  function captureBridge() {
    const scripts: string[] = [];
    const bridge = createLayerHostBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(JSON.stringify({ ok: true, createdLayers: 1, updatedLayers: 0, createdItems: 0 }));
        }
      }
    });
    function lastPayload() {
      const match = scripts[scripts.length - 1]?.match(/^NYAWORKS\.runLayerAction\("([^"]*)"\)$/);
      expect(match).not.toBeNull();
      return JSON.parse(decodeURIComponent(match![1]));
    }
    return { bridge, lastPayload };
  }

  it("keeps the legacy two-argument caller valid without requiring a language field", async () => {
    const { bridge, lastPayload } = captureBridge();
    await expect(bridge.runLayerAction("create-adjustment", "none")).resolves.toEqual({
      ok: true, createdLayers: 1, updatedLayers: 0, createdItems: 0
    });
    expect(lastPayload()).toMatchObject({ action: "create-adjustment", modifier: "none" });
  });

  it.each(LANGUAGE_IDS)("passes an explicit %s panel language to the Host", async (languageId) => {
    const { bridge, lastPayload } = captureBridge();
    await bridge.runLayerAction("create-adjustment", "none", { languageId });
    expect(lastPayload()).toMatchObject({ action: "create-adjustment", modifier: "none", languageId });
  });
  it.each([null, 42, {}, [], "en-US"].map(languageId => ({ languageId })))(
    "normalizes malformed Bridge language $languageId without rejecting old callers", async ({ languageId }) => {
      const { bridge, lastPayload } = captureBridge();
      await bridge.runLayerAction("create-adjustment", "none", { languageId } as never);
      expect(lastPayload().languageId).toBe("zh-CN");
    }
  );
});
