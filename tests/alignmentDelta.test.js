import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadCalculateAlignmentDelta() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf(
    "  function calculateAlignmentDelta(info, current, reference) {"
  );
  const end = source.indexOf(
    "  function applyLayerAlignment(layers, action, target, time, comp) {",
    start
  );
  if (start < 0 || end < 0) {
    throw new Error(
      "Could not locate calculateAlignmentDelta in the host script"
    );
  }

  return Function(
    `${source.slice(start, end)}
    return calculateAlignmentDelta;`
  )();
}

const current = {
  left: 400,
  right: 650,
  centerX: 525,
  top: 300,
  bottom: 500,
  centerY: 400
};

const reference = {
  left: 0,
  right: 1920,
  centerX: 960,
  top: 0,
  bottom: 1080,
  centerY: 540
};

describe("alignment screen delta", () => {
  it("calculates horizontal start, center and end deltas without chained ternaries", async () => {
    const calculate = await loadCalculateAlignmentDelta();

    expect(calculate(
      { axis: "x", edge: "start" },
      current,
      reference
    )).toEqual([-400, 0]);
    expect(calculate(
      { axis: "x", edge: "center" },
      current,
      reference
    )).toEqual([435, 0]);
    expect(calculate(
      { axis: "x", edge: "end" },
      current,
      reference
    )).toEqual([1270, 0]);
  });

  it("calculates vertical start, center and end deltas", async () => {
    const calculate = await loadCalculateAlignmentDelta();

    expect(calculate(
      { axis: "y", edge: "start" },
      current,
      reference
    )).toEqual([0, -300]);
    expect(calculate(
      { axis: "y", edge: "center" },
      current,
      reference
    )).toEqual([0, 140]);
    expect(calculate(
      { axis: "y", edge: "end" },
      current,
      reference
    )).toEqual([0, 580]);
  });
});
