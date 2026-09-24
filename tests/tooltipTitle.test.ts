import { describe, expect, it } from "vitest";
import { resolveTooltipTitle } from "../src/components/tooltipTitle";

describe("tooltip title restoration", () => {
  it("keeps a newly localized title instead of restoring stale copy", () => {
    expect(
      resolveTooltipTitle(
        "Left-click: Chinese / English · Right-click: choose",
        "左键切换中英 · 右键选择语言"
      )
    ).toBe("Left-click: Chinese / English · Right-click: choose");
  });

  it("restores the stored title when the element has no newer title", () => {
    expect(resolveTooltipTitle(null, "设置")).toBe("设置");
  });
});
