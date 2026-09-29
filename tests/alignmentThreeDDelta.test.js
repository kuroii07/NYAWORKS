import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadThreeDConverter() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf(
    "  function compDeltaToThreeDPositionDelta(layer, positionState, probe, deltaX, deltaY) {"
  );
  const end = source.indexOf(
    "  function compDeltaToLayerPositionDelta(layer, deltaX, deltaY) {",
    start
  );
  if (start < 0 || end < 0) {
    throw new Error(
      "Could not locate compDeltaToThreeDPositionDelta in the host script"
    );
  }

  return Function(
    `function isFiniteNumber(value) {
      return typeof value === "number" && isFinite(value);
    }
    function setPositionState(positionState, value) {
      positionState.value = value.slice(0);
      positionState.property.setValue(value);
    }
    ${source.slice(start, end)}
    return compDeltaToThreeDPositionDelta;`
  )();
}

describe("3D layer alignment delta", () => {
  it("converts a screen delta to Position X/Y and preserves Z", async () => {
    const convert = await loadThreeDConverter();
    let position = [100, 200, 300];
    const property = {
      setValue(value) {
        position = value.slice(0);
      }
    };
    const positionState = {
      property,
      separated: false,
      value: position.slice(0)
    };
    const layer = {
      sourcePointToComp() {
        return [
          position[0] * 0.5 - position[1] * 0.25,
          position[0] * 0.25 + position[1] * 0.5
        ];
      }
    };

    expect(convert(
      layer,
      positionState,
      [0, 0],
      50,
      25
    )).toEqual([100, 0]);
    expect(position).toEqual([100, 200, 300]);
    expect(positionState.value).toEqual([100, 200, 300]);
  });

  it("restores Position when the screen basis is singular", async () => {
    const convert = await loadThreeDConverter();
    let position = [10, 20, 30];
    const positionState = {
      property: {
        setValue(value) {
          position = value.slice(0);
        }
      },
      separated: false,
      value: position.slice(0)
    };
    const layer = {
      sourcePointToComp() {
        return [100, 100];
      }
    };

    expect(convert(
      layer,
      positionState,
      [0, 0],
      20,
      30
    )).toBeNull();
    expect(position).toEqual([10, 20, 30]);
  });
});
