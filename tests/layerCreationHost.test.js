import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadLayerHost(app, CompItem, LightType = {}) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf("  function decodeLayerActionPayload(encodedPayload) {");
  const end = source.indexOf("  function alignmentActionInfo(action) {", start);
  if (start < 0 || end < 0) {
    throw new Error("Could not locate layer action host functions");
  }
  return Function(
    "app",
    "CompItem",
    "LightType",
    "JSON",
    "decodeURIComponent",
    `${source.slice(start, end)}
return {
  getLayerCreationContext: getLayerCreationContext,
  runLayerAction: runLayerAction
};`
  )(app, CompItem, LightType, JSON, decodeURIComponent);
}

class TestComp {}

function property(value) {
  return {
    value,
    setValue(next) { this.value = next; }
  };
}

function createLayer(kind, options = {}) {
  const transform = {
    "ADBE Anchor Point": property([0, 0]),
    "ADBE Position": property([0, 0])
  };
  const effects = {
    added: [],
    addProperty(matchName) {
      const color = property(null);
      const effect = {
        matchName,
        property(name) {
          return name === "ADBE Fill-0002" ? color : null;
        }
      };
      this.added.push(effect);
      return effect;
    }
  };
  return {
    kind,
    index: options.index ?? 1,
    inPoint: options.inPoint ?? 0,
    outPoint: options.outPoint ?? 10,
    startTime: 0,
    selected: false,
    adjustmentLayer: false,
    sourceRectAtTime: () => ({ left: -40, top: -10, width: 80, height: 20 }),
    moveBefore(target) { this.movedBefore = target; },
    moveToBeginning() { this.movedToBeginning = true; },
    property(name) {
      if (name === "ADBE Transform Group") {
        return { property: (child) => transform[child] };
      }
      if (name === "ADBE Effect Parade") return effects;
      return null;
    },
    transform,
    effects
  };
}

function createComp(selectedLayers = []) {
  const created = [];
  const comp = Object.assign(new TestComp(), {
    width: 1920,
    height: 1080,
    pixelAspect: 1,
    displayStartTime: 5,
    duration: 20,
    selectedLayers,
    get numLayers() { return selectedLayers.length + created.length; },
    layer(index) { return [...created, ...selectedLayers][index - 1]; }
  });
  comp.layers = {
    addText(text) {
      const layer = createLayer("text");
      layer.text = text;
      created.unshift(layer);
      return layer;
    },
    addSolid(color, name, width, height, pixelAspect, duration) {
      const layer = createLayer("solid");
      Object.assign(layer, { color, name, width, height, pixelAspect, duration });
      created.unshift(layer);
      return layer;
    },
    addLight(name, point) {
      const layer = createLayer("light");
      Object.assign(layer, { name, point });
      created.unshift(layer);
      return layer;
    }
  };
  return { comp, created };
}

function payload(action, modifier = "none") {
  return encodeURIComponent(JSON.stringify({ action, modifier }));
}

describe("layer creation host context", () => {
  it("rejects a non-composition active item", async () => {
    const host = await loadLayerHost({ project: { activeItem: {} } }, TestComp);
    expect(JSON.parse(host.runLayerAction(payload("create-text")))).toEqual({
      ok: false,
      reason: "no-active-comp"
    });
  });

  it("derives full, single, and multi-selection timing and placement", async () => {
    const first = createLayer("existing", { index: 7, inPoint: 8, outPoint: 12 });
    const second = createLayer("existing", { index: 2, inPoint: 6, outPoint: 18 });
    const cases = [
      { selected: [], expected: { start: 5, end: 25, insertionIndex: null } },
      { selected: [first], expected: { start: 8, end: 12, insertionIndex: 7 } },
      { selected: [first, second], expected: { start: 6, end: 18, insertionIndex: 2 } }
    ];

    for (const item of cases) {
      const { comp } = createComp(item.selected);
      const host = await loadLayerHost({ project: { activeItem: comp } }, TestComp);
      const context = host.getLayerCreationContext();
      expect({
        start: context.start,
        end: context.end,
        insertionIndex: context.insertionIndex
      }).toEqual(item.expected);
    }
  });
});

describe("basic layer creation host actions", () => {
  it("creates centered text without assigning a font", async () => {
    const { comp, created } = createComp([]);
    const undo = [];
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup: (name) => undo.push(`begin:${name}`),
      endUndoGroup: () => undo.push("end")
    }, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-text")))).toMatchObject({
      ok: true,
      createdLayers: 1
    });
    expect(created[0].text).toBe("text");
    expect(created[0].transform["ADBE Anchor Point"].value).toEqual([0, 0]);
    expect(created[0].transform["ADBE Position"].value).toEqual([960, 540]);
    expect(created[0]).not.toHaveProperty("font");
    expect(undo).toEqual(["begin:NYAWORKS Create Layer", "end"]);
  });

  it("creates a timed black solid with Fill and a full-comp adjustment layer", async () => {
    const selected = createLayer("existing", { index: 3, inPoint: 7, outPoint: 11 });
    const { comp, created } = createComp([selected]);
    const app = {
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    };
    const host = await loadLayerHost(app, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-solid"))).ok).toBe(true);
    const solid = created[0];
    expect(solid.color).toEqual([0, 0, 0]);
    expect(solid.effects.added[0].matchName).toBe("ADBE Fill");
    expect(solid.effects.added[0].property("ADBE Fill-0002").value).toEqual([0, 0, 0]);
    expect([solid.inPoint, solid.outPoint]).toEqual([7, 11]);
    expect(solid.movedBefore).toBe(selected);

    expect(JSON.parse(host.runLayerAction(payload("create-adjustment"))).ok).toBe(true);
    expect(created[0].adjustmentLayer).toBe(true);
    expect([created[0].width, created[0].height]).toEqual([1920, 1080]);
  });

  it.each([
    ["none", "POINT"],
    ["alt", "SPOT"],
    ["ctrl", "PARALLEL"],
    ["shift", "AMBIENT"]
  ])("creates %s light variant", async (modifier, expectedType) => {
    const { comp, created } = createComp([]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp, {
      POINT: "POINT",
      SPOT: "SPOT",
      PARALLEL: "PARALLEL",
      AMBIENT: "AMBIENT"
    });

    expect(JSON.parse(host.runLayerAction(payload("create-light", modifier))).ok).toBe(true);
    expect(created[0].lightType).toBe(expectedType);
    expect(created[0].point).toEqual([960, 540]);
  });
});
