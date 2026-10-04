import { describe, expect, it } from "vitest";
import { createCepHostExecutor } from "../src/actions/executors";
import { LAYER_ACTION_DEFINITIONS } from "../src/actions/definitions/layerActions";
import type { LayerAction, LayerActionModifier } from "../src/actions/layerActionTypes";
import type { ActionContextSnapshot, NyaActionDefinition } from "../src/actions/types";
import type { LayerHostActionResult } from "../src/host/layerBridge";

const context: ActionContextSnapshot = {
  hostAvailable: true,
  activeComp: true,
  selectedLayers: 1,
  selectedKeys: 0
};

const textDefinition = LAYER_ACTION_DEFINITIONS.find(
  (definition) => definition.id === "layer.createText"
) as NyaActionDefinition;

function createRecorder(result: LayerHostActionResult = {
  ok: true,
  createdLayers: 1,
  updatedLayers: 0,
  createdItems: 0
}) {
  const calls: Array<{ action: LayerAction; modifier: LayerActionModifier }> = [];
  const executor = createCepHostExecutor(
    undefined,
    { setAnchorPoint: async () => ({ ok: false, reason: "unavailable" }) },
    { applyAlignment: async () => ({ ok: false, reason: "unavailable" }) },
    {
      runLayerAction: async (action, modifier) => {
        calls.push({ action, modifier });
        return result;
      }
    }
  );
  return { calls, executor };
}

describe("layer action executor", () => {
  it("defaults missing modifiers to none and preserves success counts", async () => {
    const { calls, executor } = createRecorder({
      ok: true,
      createdLayers: 2,
      updatedLayers: 3,
      createdItems: 1
    });

    await expect(executor(textDefinition, context)).resolves.toEqual({
      success: true,
      message: "Layer action completed",
      data: { createdLayers: 2, updatedLayers: 3, createdItems: 1 }
    });
    expect(calls).toEqual([{ action: "create-text", modifier: "none" }]);
  });

  it("passes a valid runtime modifier to the bridge", async () => {
    const { calls, executor } = createRecorder();

    await executor(textDefinition, context, { layerModifier: "shift" });

    expect(calls).toEqual([{ action: "create-text", modifier: "shift" }]);
  });

  it("rejects invalid payload actions and runtime modifiers before host execution", async () => {
    const { calls, executor } = createRecorder();

    await expect(executor({
      ...textDefinition,
      execute: {
        type: "host",
        command: "runLayerAction",
        payload: { action: "create-everything" }
      }
    }, context)).resolves.toEqual({
      success: false,
      message: "Invalid layer action",
      error: { code: "invalid-layer-action" }
    });
    await expect(executor(
      textDefinition,
      context,
      { layerModifier: "meta" } as never
    )).resolves.toEqual({
      success: false,
      message: "Invalid layer action modifier",
      error: { code: "invalid-layer-modifier" }
    });
    expect(calls).toEqual([]);
  });

  it("maps unavailable and preserves structured host failures", async () => {
    const unavailable = createRecorder({
      ok: false,
      reason: "unavailable",
      detail: "Open in AE"
    }).executor;
    await expect(unavailable(textDefinition, context)).resolves.toEqual({
      success: false,
      message: "Layer action failed",
      error: { code: "host-unavailable", detail: "Open in AE" }
    });

    const unsafe = createRecorder({
      ok: false,
      reason: "unsafe-unprecompose",
      detail: "Outer transform is not default"
    }).executor;
    await expect(unsafe(textDefinition, context)).resolves.toEqual({
      success: false,
      message: "Layer action failed",
      error: {
        code: "unsafe-unprecompose",
        detail: "Outer transform is not default"
      }
    });
  });
});
