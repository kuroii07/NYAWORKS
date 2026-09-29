import { describe, expect, it } from "vitest";
import { getAlignmentFailureMessage } from "../src/actions/alignmentFeedback";

const feedback = {
  noSelectedLayer: "select layers",
  noTextLayer: "select text",
  lockedLayer: "locked",
  unsupportedLayer: "unsupported",
  expressionConflict: "expression",
  unavailable: "unavailable",
  hostError: "host error"
};

describe("getAlignmentFailureMessage", () => {
  it("maps context and host failures to the existing localized copy", () => {
    expect(getAlignmentFailureMessage({
      code: "action-unavailable",
      detail: "selectedLayers"
    }, feedback)).toBe("select layers");
    expect(getAlignmentFailureMessage({
      code: "no-text-layer"
    }, feedback)).toBe("select text");
    expect(getAlignmentFailureMessage({
      code: "host-unavailable"
    }, feedback)).toBe("unavailable");
  });

  it("preserves actionable host details without exposing requirement names", () => {
    expect(getAlignmentFailureMessage({
      code: "expression-conflict",
      detail: "Layer 1"
    }, feedback)).toBe("expression（Layer 1）");
    expect(getAlignmentFailureMessage({
      code: "action-unavailable",
      detail: "host"
    }, feedback)).toBe("unavailable");
  });
});
