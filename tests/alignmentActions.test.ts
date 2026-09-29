import { describe, expect, it } from "vitest";
import {
  ALIGNMENT_ACTION_DEFINITIONS,
  getAlignmentActionId,
  isAlignmentActionId
} from "../src/actions/definitions/alignmentActions";
import {
  ALIGNMENT_ACTIONS,
  LAYER_ALIGNMENT_ACTIONS,
  PARAGRAPH_ALIGNMENT_ACTIONS
} from "../src/actions/alignmentTypes";

describe("alignment action definitions", () => {
  it("defines six smart layer actions and three target-independent paragraph actions", () => {
    expect(ALIGNMENT_ACTION_DEFINITIONS).toHaveLength(9);
    expect(ALIGNMENT_ACTION_DEFINITIONS.map((item) => item.id)).toEqual([
      "layer.align.left",
      "layer.align.center-x",
      "layer.align.right",
      "layer.align.top",
      "layer.align.center-y",
      "layer.align.bottom",
      "text.paragraph.left",
      "text.paragraph.center",
      "text.paragraph.right"
    ]);

    for (const action of LAYER_ALIGNMENT_ACTIONS) {
      expect(ALIGNMENT_ACTION_DEFINITIONS.find(
        (item) => item.id === getAlignmentActionId(action)
      )?.execute.payload).toEqual({ action, target: "smart" });
    }
    for (const action of PARAGRAPH_ALIGNMENT_ACTIONS) {
      expect(ALIGNMENT_ACTION_DEFINITIONS.find(
        (item) => item.id === getAlignmentActionId(action)
      )?.execute.payload).toEqual({ action });
    }
  });

  it("keeps ids stable and recognizes only registered alignment actions", () => {
    expect(ALIGNMENT_ACTIONS.map(getAlignmentActionId)).toEqual(
      ALIGNMENT_ACTION_DEFINITIONS.map((item) => item.id)
    );
    expect(isAlignmentActionId("layer.align.left")).toBe(true);
    expect(isAlignmentActionId("text.paragraph.center")).toBe(true);
    expect(isAlignmentActionId("layer.anchor.left")).toBe(false);
  });
});
