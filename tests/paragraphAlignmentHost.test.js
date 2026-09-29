import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadParagraphHost() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf(
    "  function paragraphJustificationForAction(action) {"
  );
  const end = source.indexOf(
    "  function setAlignment(encodedPayload) {",
    start
  );
  if (start < 0 || end < 0) {
    throw new Error(
      "Could not locate paragraph alignment functions in the host script"
    );
  }

  return Function(
    `var ParagraphJustification = {
      LEFT_JUSTIFY: 101,
      CENTER_JUSTIFY: 202,
      RIGHT_JUSTIFY: 303
    };
    var app = { project: { activeItem: { time: 0 } } };
    ${source.slice(start, end)}
    return {
      paragraphJustificationForAction: paragraphJustificationForAction,
      applyParagraphAlignment: applyParagraphAlignment
    };`
  )();
}

function createDocumentProperty({ numKeys = 0, initial = 0 } = {}) {
  let currentValue = { justification: initial };
  const valuesAtTime = {};

  return {
    numKeys,
    get value() {
      return { justification: currentValue.justification };
    },
    valueAtTime(time) {
      const stored = valuesAtTime[time];
      return {
        justification: stored
          ? stored.justification
          : currentValue.justification
      };
    },
    setValue(value) {
      currentValue = { justification: value.justification };
    },
    setValueAtTime(time, value) {
      valuesAtTime[time] = { justification: value.justification };
      currentValue = { justification: value.justification };
    },
    read(time) {
      return time === undefined
        ? currentValue.justification
        : valuesAtTime[time]?.justification;
    }
  };
}

function createTextLayer(documentProperty, {
  locked = false,
  sourceTextAlias = true,
  time = 0
} = {}) {
  return {
    locked,
    containingComp: { time },
    property(name) {
      if (name === "Source Text") {
        return sourceTextAlias ? documentProperty : null;
      }
      if (name === "ADBE Text Properties") {
        return {
          property(matchName) {
            return matchName === "ADBE Text Document"
              ? documentProperty
              : null;
          }
        };
      }
      return null;
    }
  };
}

describe("paragraph alignment host mapping", () => {
  it("maps each paragraph action to its matching AE justification", async () => {
    const { paragraphJustificationForAction: mapAction } =
      await loadParagraphHost();

    expect(mapAction("paragraph-left")).toBe(101);
    expect(mapAction("paragraph-center")).toBe(202);
    expect(mapAction("paragraph-right")).toBe(303);
    expect(mapAction("left")).toBeNull();
  });
});

describe("paragraph alignment host behavior", () => {
  it("updates point and box text while skipping non-text and locked layers", async () => {
    const { applyParagraphAlignment } = await loadParagraphHost();
    const pointText = createDocumentProperty();
    const boxText = createDocumentProperty();
    const lockedText = createDocumentProperty();
    const nonTextLayer = {
      locked: false,
      property() {
        return null;
      }
    };

    const result = applyParagraphAlignment([
      createTextLayer(pointText),
      createTextLayer(boxText, { sourceTextAlias: false }),
      nonTextLayer,
      createTextLayer(lockedText, { locked: true })
    ], "paragraph-right");

    expect(result).toEqual({
      updatedLayers: 2,
      reason: "no-text-layer",
      detail: null
    });
    expect(pointText.read()).toBe(303);
    expect(boxText.read()).toBe(303);
    expect(lockedText.read()).toBe(0);
  });

  it("writes keyed Source Text at the active composition time", async () => {
    const { applyParagraphAlignment } = await loadParagraphHost();
    const keyedText = createDocumentProperty({ numKeys: 2 });

    const result = applyParagraphAlignment([
      createTextLayer(keyedText, { time: 1.5 })
    ], "paragraph-center");

    expect(result).toEqual({
      updatedLayers: 1,
      reason: null,
      detail: null
    });
    expect(keyedText.read(1.5)).toBe(202);
  });
});
