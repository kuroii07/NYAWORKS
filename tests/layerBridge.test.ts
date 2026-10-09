import { describe, expect, it } from "vitest";
import { createLayerHostBridge } from "../src/host/layerBridge";

describe("layer host bridge", () => {
  it("encodes the action and modifier before calling the AE host", async () => {
    let received = "";
    const bridge = createLayerHostBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          received = script;
          callback(JSON.stringify({
            ok: true,
            createdLayers: 2,
            updatedLayers: 3,
            createdItems: 1
          }));
        }
      }
    });

    await expect(bridge.runLayerAction("create-shape", "alt")).resolves.toEqual({
      ok: true,
      createdLayers: 2,
      updatedLayers: 3,
      createdItems: 1
    });
    expect(received).toMatch(/^NYAWORKS\.runLayerAction\(".+"\)$/);
    expect(JSON.parse(decodeURIComponent(received.match(/\("(.+)"\)$/)?.[1] ?? ""))).toEqual({
      action: "create-shape",
      modifier: "alt"
    });
  });

  it("passes the current CEP extension directory for a normal rounded rectangle", async () => {
    let received = "";
    const bridge = createLayerHostBridge({
      __adobe_cep__: {
        getSystemPath: (type) => {
          expect(type).toBe("extension");
          return "file:///D:/AE%E8%84%9A%E6%9C%AC/NYAWORKS";
        },
        evalScript: (script, callback) => {
          received = script;
          callback(JSON.stringify({
            ok: true,
            createdLayers: 1,
            updatedLayers: 0,
            createdItems: 0
          }));
        }
      }
    });

    await expect(bridge.runLayerAction("create-shape", "none")).resolves.toMatchObject({
      ok: true,
      createdLayers: 1
    });
    expect(JSON.parse(decodeURIComponent(received.match(/\("(.+)"\)$/)?.[1] ?? ""))).toEqual({
      action: "create-shape",
      modifier: "none",
      extensionRoot: "D:/AE脚本/NYAWORKS"
    });
  });

  it("invokes the CEP path API with its runtime receiver", async () => {
    let received = "";
    const runtime = {
      evalScript(script: string, callback: (result: string) => void) {
        received = script;
        callback(JSON.stringify({ ok: true, createdLayers: 1 }));
      },
      getSystemPath(type: string) {
        expect(this).toBe(runtime);
        expect(type).toBe("extension");
        return "file:///C:/NYAWORKS";
      }
    };
    const bridge = createLayerHostBridge({ __adobe_cep__: runtime });
    await expect(bridge.runLayerAction("create-shape", "none")).resolves.toMatchObject({
      ok: true
    });
    expect(JSON.parse(decodeURIComponent(received.match(/\("(.+)"\)$/)?.[1] ?? "")))
      .toMatchObject({ extensionRoot: "C:/NYAWORKS" });
  });

  it("does not call AE for a rounded rectangle when the extension directory is unavailable", async () => {
    let called = false;
    const bridge = createLayerHostBridge({
      __adobe_cep__: {
        evalScript: () => { called = true; }
      }
    });
    await expect(bridge.runLayerAction("create-shape", "none")).resolves.toEqual({
      ok: false,
      reason: "host-error",
      detail: "pseudo-extension-root-unavailable"
    });
    expect(called).toBe(false);
  });

  it("normalizes unavailable and malformed host responses", async () => {
    await expect(
      createLayerHostBridge({}).runLayerAction("create-text", "none")
    ).resolves.toMatchObject({ ok: false, reason: "unavailable" });

    const malformed = createLayerHostBridge({
      __adobe_cep__: {
        evalScript: (_script, callback) => callback("not-json")
      }
    });
    await expect(
      malformed.runLayerAction("create-text", "none")
    ).resolves.toEqual({ ok: false, reason: "invalid-host-response" });
  });

  it.each([
    "no-active-comp",
    "no-selected-layer",
    "invalid-selection",
    "unsupported-layer-type",
    "unsupported-precomp",
    "unsafe-unprecompose",
    "host-error"
  ] as const)("preserves allowlisted failure reason %s", async (reason) => {
    const bridge = createLayerHostBridge({
      __adobe_cep__: {
        evalScript: (_script, callback) => callback(JSON.stringify({
          ok: false,
          reason,
          detail: "host detail"
        }))
      }
    });

    await expect(
      bridge.runLayerAction("unprecompose-selected", "none")
    ).resolves.toEqual({ ok: false, reason, detail: "host detail" });
  });

  it("maps unknown host failure reasons to host-error", async () => {
    const bridge = createLayerHostBridge({
      __adobe_cep__: {
        evalScript: (_script, callback) => callback(JSON.stringify({
          ok: false,
          reason: "unexpected",
          detail: "raw detail"
        }))
      }
    });

    await expect(
      bridge.runLayerAction("create-solid", "none")
    ).resolves.toEqual({
      ok: false,
      reason: "host-error",
      detail: "raw detail"
    });
  });
});
