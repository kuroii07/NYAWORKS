import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadCompDeltaToLayerPositionDelta() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf(
    "  function compDeltaToLayerPositionDelta(layer, deltaX, deltaY) {"
  );
  const end = source.indexOf(
    "  function moveLayerByCompDelta(layer, deltaX, deltaY, time) {",
    start
  );
  if (start < 0 || end < 0) {
    throw new Error(
      "Could not locate compDeltaToLayerPositionDelta in the host script"
    );
  }

  return Function(
    `function isFiniteNumber(value) {
      return typeof value === "number" && isFinite(value);
    }
    ${source.slice(start, end)}
    return compDeltaToLayerPositionDelta;`
  )();
}

describe("parented layer alignment delta", () => {
  it("keeps comp deltas unchanged for unparented 2D layers", async () => {
    const convert = await loadCompDeltaToLayerPositionDelta();

    expect(convert({
      threeDLayer: false,
      parent: null
    }, 120, -40)).toEqual([120, -40]);
  });

  it("converts a comp delta through the parent 2D basis", async () => {
    const convert = await loadCompDeltaToLayerPositionDelta();
    const parent = {
      threeDLayer: false,
      parent: null,
      sourcePointToComp(point) {
        return [
          100 - point[1] * 0.5,
          200 + point[0] * 0.5
        ];
      }
    };

    expect(convert({
      threeDLayer: false,
      parent
    }, 100, 0)).toEqual([0, -200]);
  });

  it("rejects singular or 3D parent transforms instead of moving incorrectly", async () => {
    const convert = await loadCompDeltaToLayerPositionDelta();

    expect(convert({
      threeDLayer: false,
      parent: {
        threeDLayer: false,
        parent: null,
        sourcePointToComp() {
          return [10, 10];
        }
      }
    }, 10, 20)).toBeNull();
    expect(convert({
      threeDLayer: false,
      parent: {
        threeDLayer: true,
        parent: null,
        sourcePointToComp(point) {
          return point;
        }
      }
    }, 10, 20)).toBeNull();
  });
});
