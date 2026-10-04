import { describe, expect, it } from "vitest";
import {
  getLayerActionId,
  isLayerAction,
  isLayerActionModifier,
  LAYER_ACTIONS
} from "../src/actions/layerActionTypes";
import { LAYER_ACTION_DEFINITIONS } from "../src/actions/definitions/layerActions";

describe("layer action definitions", () => {
  it("registers the nine grid actions in product order", () => {
    expect(LAYER_ACTION_DEFINITIONS.map((action) => action.id)).toEqual([
      "layer.createText",
      "layer.createSolid",
      "layer.createShape",
      "layer.createAdjustment",
      "layer.createNull",
      "layer.createCameraRig",
      "layer.createLight",
      "layer.precomposeSelected",
      "layer.unprecomposeSelected"
    ]);
  });

  it("uses the shared host command and correct requirements", () => {
    for (const definition of LAYER_ACTION_DEFINITIONS) {
      expect(definition.execute.command).toBe("runLayerAction");
      expect(definition.supportsPie).toBe(true);
      expect(definition.undoPolicy).toBe("host-undo-group");
      expect(definition.requirements.slice(0, 2)).toEqual(["host", "activeComp"]);
      expect(definition.execute.payload).toEqual({
        action: expect.any(String)
      });
    }

    expect(LAYER_ACTION_DEFINITIONS.slice(0, 7).every(
      (definition) => definition.requirements.join(",") === "host,activeComp"
    )).toBe(true);
    expect(LAYER_ACTION_DEFINITIONS.slice(7).every(
      (definition) => definition.requirements.join(",") === "host,activeComp,selectedLayers"
    )).toBe(true);
  });

  it("maps only registered actions and modifiers", () => {
    expect(LAYER_ACTIONS.map(getLayerActionId)).toEqual(
      LAYER_ACTION_DEFINITIONS.map((definition) => definition.id)
    );
    expect(LAYER_ACTIONS.every(isLayerAction)).toBe(true);
    expect(isLayerAction("create-comp")).toBe(false);
    expect(["none", "alt", "ctrl", "shift"].every(isLayerActionModifier)).toBe(true);
    expect(isLayerActionModifier("triple")).toBe(false);
  });
});
