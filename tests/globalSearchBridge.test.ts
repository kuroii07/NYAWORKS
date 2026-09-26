import { describe, expect, it } from "vitest";
import {
  createGlobalSearchHostBridge,
  type HostEffectItem
} from "../src/host/globalSearchBridge";

const effect: HostEffectItem = {
  id: "effect:gaussian-blur",
  name: "Gaussian Blur",
  matchName: "ADBE Gaussian Blur 2",
  aliases: ["高斯模糊"]
};

describe("global search host bridge", () => {
  it("reports unavailable CEP and malformed effects safely", async () => {
    await expect(createGlobalSearchHostBridge({}).readCurrentAeEffects()).resolves.toEqual({
      status: "unavailable",
      effects: [],
      isDevelopmentFixture: false
    });

    const malformed = createGlobalSearchHostBridge({
      __adobe_cep__: { evalScript: (_script, callback) => callback("not-json") }
    });
    await expect(malformed.readCurrentAeEffects()).resolves.toEqual({
      status: "error",
      effects: [],
      isDevelopmentFixture: false
    });
  });

  it("normalizes current AE effect records", async () => {
    const bridge = createGlobalSearchHostBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          expect(script).toBe("NYAWORKS.getCurrentEffects()");
          callback(JSON.stringify({ ok: true, effects: [effect, { name: "", matchName: 3 }] }));
        }
      }
    });
    await expect(bridge.readCurrentAeEffects()).resolves.toEqual({
      status: "connected",
      effects: [effect],
      isDevelopmentFixture: false
    });
  });

  it("encodes script, preset and effect actions before host execution", async () => {
    const scripts: string[] = [];
    const bridge = createGlobalSearchHostBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(JSON.stringify({ ok: true }));
        }
      }
    });

    await expect(bridge.executeGlobalSearchAction({
      action: "run-script",
      path: "C:/Tools/我的脚本.jsx"
    })).resolves.toEqual({ ok: true });
    await expect(bridge.executeGlobalSearchAction({
      action: "apply-preset",
      path: "C:/Presets/Glow & Blur.ffx"
    })).resolves.toEqual({ ok: true });
    await expect(bridge.executeGlobalSearchAction({
      action: "add-effect",
      matchName: effect.matchName
    })).resolves.toEqual({ ok: true });

    expect(scripts[0]).toMatch(/^NYAWORKS\.runSearchScript\(".+"\)$/);
    expect(JSON.parse(decodeURIComponent(scripts[0].match(/\("(.+)"\)$/)?.[1] ?? ""))).toEqual({
      path: "C:/Tools/我的脚本.jsx"
    });
    expect(scripts[1]).toMatch(/^NYAWORKS\.applySearchPreset\(".+"\)$/);
    expect(scripts[2]).toMatch(/^NYAWORKS\.addSearchEffect\(".+"\)$/);
  });

  it("returns a host error when no layer is selected", async () => {
    const bridge = createGlobalSearchHostBridge({
      __adobe_cep__: {
        evalScript: (_script, callback) => callback(JSON.stringify({
          ok: false,
          reason: "no-selected-layer"
        }))
      }
    });
    await expect(bridge.executeGlobalSearchAction({
      action: "add-effect",
      matchName: effect.matchName
    })).resolves.toEqual({ ok: false, reason: "no-selected-layer" });
  });
});
