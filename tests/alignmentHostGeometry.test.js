import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadReadCompPoint() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf("  function readCompPoint(layer, point) {");
  const end = source.indexOf(
    "  function readFallback2dCompBounds(layer, rect) {",
    start
  );
  if (start < 0 || end < 0) {
    throw new Error("Could not locate readCompPoint in the host script");
  }

  return Function(
    `${source.slice(start, end)}; return readCompPoint;`
  )();
}

describe("alignment host geometry", () => {
  it("uses the two-value sourcePointToComp overload for 2D layers", async () => {
    const readCompPoint = await loadReadCompPoint();
    const received = [];
    const layer = {
      threeDLayer: false,
      sourcePointToComp(point) {
        received.push(point);
        if (point.length !== 2) {
          throw new Error("value array does not have 2 elements");
        }
        return [point[0] + 10, point[1] + 20];
      }
    };

    expect(readCompPoint(layer, [5, 5, 0])).toEqual([15, 25]);
    expect(received).toEqual([[5, 5]]);
  });

  it("uses the two-value sourcePointToComp overload for 3D layer source points", async () => {
    const readCompPoint = await loadReadCompPoint();
    const received = [];
    const layer = {
      threeDLayer: true,
      sourcePointToComp(point) {
        received.push(point);
        if (point.length !== 2) {
          throw new Error("value array does not have 2 elements");
        }
        return [point[0] * 2, point[1] * 3];
      }
    };

    expect(readCompPoint(layer, [7, 11, 0])).toEqual([14, 33]);
    expect(received).toEqual([[7, 11]]);
  });

  it("prefers the documented 2D source point when a 3D layer accepts an ambiguous three-value point", async () => {
    const readCompPoint = await loadReadCompPoint();
    const received = [];
    const layer = {
      threeDLayer: true,
      sourcePointToComp(point) {
        received.push(point);
        return point.length === 2
          ? [point[0] * 2, point[1] * 3]
          : [999, 999];
      }
    };

    expect(readCompPoint(layer, [7, 11, 0])).toEqual([14, 33]);
    expect(received[0]).toEqual([7, 11]);
  });
});
