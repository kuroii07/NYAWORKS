import { describe, expect, it } from "vitest";
import { createCepHostExecutor } from "../src/actions/executors";
import {
  getAlignmentActionId,
  ALIGNMENT_ACTION_DEFINITIONS
} from "../src/actions/definitions/alignmentActions";
import type { AlignmentAction, AlignmentTarget } from "../src/actions/alignmentTypes";
import type { ActionContextSnapshot, NyaActionDefinition } from "../src/actions/types";

const baseContext: ActionContextSnapshot = {
  hostAvailable: true,
  activeComp: true,
  selectedLayers: 1,
  selectedKeys: 0
};

function definition(action: AlignmentAction): NyaActionDefinition {
  const found = ALIGNMENT_ACTION_DEFINITIONS.find(
    (candidate) => candidate.id === getAlignmentActionId(action)
  );
  if (!found) throw new Error(`Missing test definition for ${action}`);
  return found;
}

function createRecorder() {
  const calls: Array<{ action: AlignmentAction; target: AlignmentTarget }> = [];
  const executor = createCepHostExecutor(
    undefined,
    {
      setAnchorPoint: async () => ({
        ok: true,
        updatedLayers: 0,
        threeDLayers: 0
      })
    },
    {
      applyAlignment: async (action, target) => {
        calls.push({ action, target });
        return { ok: true, updatedLayers: 2 };
      }
    }
  );
  return { calls, executor };
}

describe("alignment action executor", () => {
  it("resolves smart layer alignment to composition for one selected layer", async () => {
    const { calls, executor } = createRecorder();

    await expect(executor(definition("left"), baseContext)).resolves.toEqual({
      success: true,
      message: "Alignment updated",
      data: { updatedLayers: 2 }
    });
    expect(calls).toEqual([{ action: "left", target: "composition" }]);
  });

  it("resolves smart layer alignment to selection for multiple selected layers", async () => {
    const { calls, executor } = createRecorder();

    await executor(definition("center-x"), {
      ...baseContext,
      selectedLayers: 3
    });
    expect(calls).toEqual([{ action: "center-x", target: "selection" }]);
  });

  it("lets a modifier override multiple selected layers back to composition", async () => {
    const { calls, executor } = createRecorder();

    await executor(
      definition("right"),
      { ...baseContext, selectedLayers: 3 },
      { alignmentTarget: "composition" }
    );
    expect(calls).toEqual([{ action: "right", target: "composition" }]);
  });

  it("keeps paragraph alignment independent from layer target overrides", async () => {
    const { calls, executor } = createRecorder();

    await executor(
      definition("paragraph-center"),
      { ...baseContext, selectedLayers: 3 },
      { alignmentTarget: "selection" }
    );
    expect(calls).toEqual([
      { action: "paragraph-center", target: "composition" }
    ]);
  });

  it("preserves alignment host failures and rejects invalid action payloads", async () => {
    let calls = 0;
    const executor = createCepHostExecutor(
      undefined,
      {
        setAnchorPoint: async () => ({
          ok: true,
          updatedLayers: 0,
          threeDLayers: 0
        })
      },
      {
        applyAlignment: async () => {
          calls += 1;
          return {
            ok: false,
            reason: "expression-conflict",
            detail: "Layer 1"
          };
        }
      }
    );

    await expect(executor(definition("top"), baseContext)).resolves.toEqual({
      success: false,
      message: "Alignment action failed",
      error: { code: "expression-conflict", detail: "Layer 1" }
    });
    await expect(executor({
      ...definition("top"),
      execute: {
        type: "host",
        command: "setAlignment",
        payload: { action: "diagonal", target: "smart" }
      }
    }, baseContext)).resolves.toEqual({
      success: false,
      message: "Invalid alignment action",
      error: { code: "invalid-alignment-action" }
    });
    expect(calls).toBe(1);
  });

  it("rejects invalid layer target strategies and runtime overrides", async () => {
    const { calls, executor } = createRecorder();
    const left = definition("left");

    await expect(executor({
      ...left,
      execute: {
        ...left.execute,
        payload: { action: "left", target: "outside" }
      }
    }, baseContext)).resolves.toEqual({
      success: false,
      message: "Invalid alignment target",
      error: { code: "invalid-alignment-target" }
    });
    await expect(executor(
      left,
      baseContext,
      { alignmentTarget: "outside" } as never
    )).resolves.toEqual({
      success: false,
      message: "Invalid alignment target",
      error: { code: "invalid-alignment-target" }
    });
    expect(calls).toEqual([]);
  });
});
