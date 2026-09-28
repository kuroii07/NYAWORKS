import { describe, expect, it } from "vitest";
import { resolveFourWayDirection } from "../src/nyaPie/p0/direction";

describe("resolveFourWayDirection", () => {
  const center = { x: 100, y: 100 };

  it("returns null inside the dead zone", () => {
    expect(resolveFourWayDirection({ x: 110, y: 110 }, center, 20)).toBeNull();
  });

  it.each([
    [{ x: 100, y: 40 }, "top"],
    [{ x: 160, y: 100 }, "right"],
    [{ x: 100, y: 160 }, "bottom"],
    [{ x: 40, y: 100 }, "left"]
  ] as const)("maps %o to %s", (point, expected) => {
    expect(resolveFourWayDirection(point, center, 20)).toBe(expected);
  });

  it("uses the vertical direction when a point is exactly diagonal", () => {
    expect(resolveFourWayDirection({ x: 140, y: 60 }, center, 20)).toBe("top");
    expect(resolveFourWayDirection({ x: 60, y: 140 }, center, 20)).toBe("bottom");
  });
});
