import { describe, expect, it } from "vitest";
import {
  ANCHOR_ACTION_DEFINITIONS,
  getAnchorActionId
} from "../src/actions/definitions/anchorActions";
import { ANCHOR_POSITIONS } from "../src/host/anchorBridge";

describe("anchor action definitions", () => {
  it("registers the nine positions in grid order", () => {
    expect(ANCHOR_ACTION_DEFINITIONS.map((action) => action.id)).toEqual([
      "layer.anchor.top-left",
      "layer.anchor.top",
      "layer.anchor.top-right",
      "layer.anchor.left",
      "layer.anchor.center",
      "layer.anchor.right",
      "layer.anchor.bottom-left",
      "layer.anchor.bottom",
      "layer.anchor.bottom-right"
    ]);
    expect(ANCHOR_ACTION_DEFINITIONS.every((action) =>
      action.execute.command === "setAnchorPoint" &&
      action.requirements.join(",") === "host,activeComp,selectedLayers" &&
      action.supportsPie
    )).toBe(true);
    expect(ANCHOR_ACTION_DEFINITIONS.map((action) => action.execute.payload)).toEqual(
      ANCHOR_POSITIONS.map((position) => ({ position }))
    );
  });

  it("maps every grid position to its stable action id", () => {
    expect(ANCHOR_POSITIONS.map(getAnchorActionId)).toEqual(
      ANCHOR_ACTION_DEFINITIONS.map((action) => action.id)
    );
  });
});
