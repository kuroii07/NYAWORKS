import { describe, expect, it } from "vitest";
import { getAnchorFailureMessage } from "../src/actions/anchorFeedback";

const feedback = {
  noSelectedLayer: "select layers",
  lockedLayer: "locked",
  unsupportedLayer: "unsupported",
  expressionConflict: "expression",
  unavailable: "unavailable",
  hostError: "host error"
};

describe("getAnchorFailureMessage", () => {
  it("maps unavailable action requirements to existing localized feedback", () => {
    expect(getAnchorFailureMessage({
      code: "action-unavailable",
      detail: "host"
    }, feedback)).toBe("unavailable");
    expect(getAnchorFailureMessage({
      code: "action-unavailable",
      detail: "selectedLayers"
    }, feedback)).toBe("select layers");
    expect(getAnchorFailureMessage({
      code: "action-unavailable",
      detail: "activeComp"
    }, feedback)).toBe("host error");
  });

  it("preserves structured host error meanings and detail", () => {
    expect(getAnchorFailureMessage({
      code: "locked-layer",
      detail: "Layer 2"
    }, feedback)).toBe("locked（Layer 2）");
    expect(getAnchorFailureMessage({
      code: "invalid-host-response"
    }, feedback)).toBe("host error");
  });
});
