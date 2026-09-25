import { describe, expect, it } from "vitest";
import { getTooltipPosition } from "../src/components/tooltipPosition";

const targetRect = {
  bottom: 360,
  height: 52,
  left: 6,
  right: 58,
  top: 308,
  width: 52
};

describe("tooltip positioning", () => {
  it("places sidebar tooltips beside the icon instead of beneath its button", () => {
    expect(getTooltipPosition(targetRect, 1200, 800, true)).toEqual({
      placement: "right",
      left: 66,
      top: 334
    });
  });

  it("keeps general tooltips centered beneath their target", () => {
    expect(getTooltipPosition(targetRect, 1200, 800, false)).toEqual({
      placement: "bottom",
      left: 104,
      top: 368
    });
  });
});
