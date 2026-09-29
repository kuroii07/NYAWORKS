import { describe, expect, it } from "vitest";
import { createCepHostExecutor } from "../src/actions/executors";
import { ANCHOR_POSITIONS } from "../src/actions/anchorTypes";
import type {
  ActionContextSnapshot,
  NyaActionDefinition
} from "../src/actions/types";

const definition: NyaActionDefinition = {
  id: "p0.direction.top",
  title: {
    zhCN: "上",
    zhTW: "上",
    en: "Top",
    ja: "上",
    ko: "위"
  },
  icon: "ArrowUp",
  category: "utility",
  requirements: ["host"],
  supportsPie: true,
  execute: {
    type: "host",
    command: "runP0TestAction"
  },
  undoPolicy: "none"
};

const context: ActionContextSnapshot = {
  hostAvailable: true,
  activeComp: false,
  selectedLayers: 0,
  selectedKeys: 0
};

describe("createCepHostExecutor", () => {
  it("routes a valid anchor position through the anchor bridge", async () => {
    const calls: string[] = [];
    const executor = createCepHostExecutor(undefined, {
      setAnchorPoint: async (position) => {
        calls.push(position);
        return { ok: true, updatedLayers: 2, threeDLayers: 1 };
      }
    });

    await expect(executor({
      ...definition,
      id: "layer.anchor.bottom-right",
      execute: {
        type: "host",
        command: "setAnchorPoint",
        payload: { position: "bottom-right" }
      }
    }, context)).resolves.toEqual({
      success: true,
      message: "Anchor point updated",
      data: { updatedLayers: 2, threeDLayers: 1 }
    });
    expect(calls).toEqual(["bottom-right"]);
  });

  it("routes all nine allowlisted positions through the anchor bridge", async () => {
    const calls: string[] = [];
    const executor = createCepHostExecutor(undefined, {
      setAnchorPoint: async (position) => {
        calls.push(position);
        return { ok: true, updatedLayers: 1, threeDLayers: 0 };
      }
    });

    for (const position of ANCHOR_POSITIONS) {
      const result = await executor({
        ...definition,
        id: `layer.anchor.${position}`,
        execute: {
          type: "host",
          command: "setAnchorPoint",
          payload: { position }
        }
      }, context);
      expect(result.success).toBe(true);
    }
    expect(calls).toEqual(ANCHOR_POSITIONS);
  });

  it("rejects an invalid anchor position without calling the bridge", async () => {
    let calls = 0;
    const executor = createCepHostExecutor(undefined, {
      setAnchorPoint: async () => {
        calls += 1;
        return { ok: true, updatedLayers: 1, threeDLayers: 0 };
      }
    });

    await expect(executor({
      ...definition,
      execute: {
        type: "host",
        command: "setAnchorPoint",
        payload: { position: "outside" }
      }
    }, context)).resolves.toEqual({
      success: false,
      message: "Invalid anchor position",
      error: { code: "invalid-anchor-position" }
    });
    expect(calls).toBe(0);
  });

  it("normalizes an unavailable anchor bridge to the shared host error code", async () => {
    const executor = createCepHostExecutor(undefined, {
      setAnchorPoint: async () => ({ ok: false, reason: "unavailable" })
    });

    const result = await executor({
      ...definition,
      id: "layer.anchor.center",
      execute: {
        type: "host",
        command: "setAnchorPoint",
        payload: { position: "center" }
      }
    }, context);

    expect(result.error?.code).toBe("host-unavailable");
  });

  it("preserves structured anchor host failure reasons", async () => {
    const executor = createCepHostExecutor(undefined, {
      setAnchorPoint: async () => ({
        ok: false,
        reason: "locked-layer",
        detail: "Layer 2"
      })
    });

    const result = await executor({
      ...definition,
      id: "layer.anchor.center",
      execute: {
        type: "host",
        command: "setAnchorPoint",
        payload: { position: "center" }
      }
    }, context);

    expect(result).toEqual({
      success: false,
      message: "Anchor action failed",
      error: { code: "locked-layer", detail: "Layer 2" }
    });
  });

  it("calls the allowlisted P0 host command and parses its result", async () => {
    let script = "";
    const executor = createCepHostExecutor({
      __adobe_cep__: {
        evalScript(value, callback) {
          script = value;
          callback(
            JSON.stringify({
              ok: true,
              message: "P0 action received",
              data: {
                actionId: "p0.direction.top",
                aeVersion: "25.0"
              }
            })
          );
        }
      }
    });

    await expect(executor(definition, context)).resolves.toEqual({
      success: true,
      message: "P0 action received",
      data: {
        actionId: "p0.direction.top",
        aeVersion: "25.0"
      }
    });
    expect(script).toMatch(/^NYAWORKS\.runP0TestAction\("/);
    expect(decodeURIComponent(script.match(/"([^"]+)"/)?.[1] ?? "")).toBe(
      JSON.stringify({ actionId: "p0.direction.top" })
    );
  });

  it("preserves the P0 invalid-response contract", async () => {
    const executor = createCepHostExecutor({
      __adobe_cep__: {
        evalScript(_value, callback) {
          callback("not-json");
        }
      }
    });

    await expect(executor(definition, context)).resolves.toEqual({
      success: false,
      message: "Invalid P0 host response",
      error: { code: "invalid-host-response" }
    });
  });

  it("does not execute host commands outside the P0 allowlist", async () => {
    const executor = createCepHostExecutor({
      __adobe_cep__: {
        evalScript() {
          throw new Error("must not be called");
        }
      }
    });

    await expect(
      executor(
        {
          ...definition,
          execute: {
            type: "host",
            command: "unsafeCommand"
          }
        },
        context
      )
    ).resolves.toEqual({
      success: false,
      message: "Unsupported P0 host command",
      error: {
        code: "unsupported-host-command",
        detail: "unsafeCommand"
      }
    });
  });
});
