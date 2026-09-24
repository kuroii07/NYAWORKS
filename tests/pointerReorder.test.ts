import { describe, expect, it } from "vitest";
import {
  getPointerAutoScrollDelta,
  hasPointerDragExceededThreshold
} from "../src/interactions/pointerReorder";

describe("pointer reorder helpers", () => {
  it("starts dragging only after the pointer moves beyond four pixels", () => {
    expect(
      hasPointerDragExceededThreshold(
        { x: 10, y: 10 },
        { x: 13, y: 12 }
      )
    ).toBe(false);
    expect(
      hasPointerDragExceededThreshold(
        { x: 10, y: 10 },
        { x: 14, y: 10 }
      )
    ).toBe(true);
  });

  it("returns bounded signed scrolling near the workspace edges", () => {
    const bounds = { top: 100, bottom: 500 };

    expect(getPointerAutoScrollDelta(300, bounds)).toBe(0);
    expect(getPointerAutoScrollDelta(100, bounds)).toBe(-14);
    expect(getPointerAutoScrollDelta(500, bounds)).toBe(14);
    expect(getPointerAutoScrollDelta(125, bounds)).toBeLessThan(0);
    expect(getPointerAutoScrollDelta(475, bounds)).toBeGreaterThan(0);
  });
});
