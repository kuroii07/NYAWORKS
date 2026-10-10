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
    "Window",
    "$",
    "JSON",
    "decodeURIComponent",
    `${source.slice(start, end)}
return {
  getLayerCreationContext: getLayerCreationContext,
  runLayerAction: runLayerAction,
  readSelectedTextLayer: readSelectedTextLayer,
  applyTextLayerEdit: applyTextLayerEdit,
  createTextLayerFromEditor: createTextLayerFromEditor
};`
  )(app, CompItem, LightType, FakeScriptUIWindow, { global: {} }, JSON, decodeURIComponent);
}

class TestComp {}

class FakeScriptUIWindow {
  static last = null;

  constructor(type, title) {
    this.type = type;
    this.title = title;
    this.controls = {};
    FakeScriptUIWindow.last = this;
  }

  add(type, _bounds, text, options) {
    if (type === "group") {
      return {
        add: (childType, bounds, childText, childOptions) =>
          this.add(childType, bounds, childText, childOptions)
      };
    }

    const control = {
      type,
      text: text ?? "",
      options,
      onClick: null
    };
    this.controls[type === "edittext" ? "input" : text] = control;
    return control;
  }

  center() {}
  show() { this.shown = true; }
}

function property(value) {
  return {
    value,
    setValue(next) { this.value = next; }
  };
}

function createLayer(kind, options = {}) {
  let layerName = options.name ?? "";
  let nameSetCount = 0;
  const transform = {
    "ADBE Anchor Point": property([0, 0]),
    "ADBE Position": property([0, 0]),
    "ADBE Point of Interest": property([0, 0, 0])
  };
  const effects = {
    added: [],
    addProperty(matchName) {
      const color = property(null);
      const effect = {
        matchName,
        property(name) {
          return name === "ADBE Fill-0002" || name === 1 ? color : null;
        }
      };
      this.added.push(effect);
      return effect;
    }
  };
  const textDocument = options.textDocumentProperty !== undefined
    ? options.textDocumentProperty
    : options.textDocument
      ? property(options.textDocument)
      : null;
  return {
    kind,
    get name() { return layerName; },
    set name(value) {
      layerName = value;
      nameSetCount += 1;
    },
    get nameSetCount() { return nameSetCount; },
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
      if (name === "ADBE Text Properties") {
        return {
          property(child) {
            return child === "ADBE Text Document" ? textDocument : null;
          }
        };
      }
      if (name === "ADBE Transform Group") {
        return { property: (child) => transform[child] };
      }
      if (name === "ADBE Effect Parade") return effects;
      return null;
    },
    textDocument,
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
      const layer = createLayer("text", { name: text });
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

function payload(action, modifier = "none", textDialogLabels) {
  return encodeURIComponent(JSON.stringify({ action, modifier, textDialogLabels }));
}

describe("layer creation host context", () => {
  it("rejects a non-composition active item", async () => {
    const host = await loadLayerHost({ project: { activeItem: {} } }, TestComp);
    expect(JSON.parse(host.runLayerAction(payload("create-text")))).toEqual({
      ok: false,
      reason: "no-active-comp"
    });
  });

  it("routes Alt text editing to the dedicated CEP editor", async () => {
    const host = await loadLayerHost({ project: { activeItem: {} } }, TestComp);
    expect(JSON.parse(host.runLayerAction(payload("create-text", "alt")))).toEqual({
      ok: false,
      reason: "host-error",
      detail: "text-editor-ui-required"
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
  it("creates centered text named after its actual source text without assigning a font", async () => {
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
    expect(created[0].name).toBe("text");
    expect(created[0].nameSetCount).toBe(0);
    expect(created[0].transform["ADBE Anchor Point"].value).toEqual([0, 0]);
    expect(created[0].transform["ADBE Position"].value).toEqual([960, 540]);
    expect(created[0]).not.toHaveProperty("font");
    expect(undo).toEqual(["begin:NYAWORKS Create Layer", "end"]);
  });

  it("keeps the text action as a single AE-default point text operation", async () => {
    const { comp, created } = createComp([]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-text", "ctrl"))).ok).toBe(true);
    expect(created[0]).toMatchObject({
      kind: "text",
      text: "text",
      name: "text"
    });
    expect(created[0]).not.toHaveProperty("font");
  });

  it("creates entered text from the dedicated editor without assigning a layer name", async () => {
    const { comp, created } = createComp([]);
    const app = {
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    };
    const host = await loadLayerHost(app, TestComp);
    const result = JSON.parse(host.createTextLayerFromEditor(
      encodeURIComponent(JSON.stringify({ text: "A multiline\nNya title" }))
    ));

    expect(result).toMatchObject({ ok: true, createdLayers: 1 });
    expect(created[0].text).toBe("A multiline\nNya title");
    expect(created[0].name).toBe("A multiline\nNya title");
    expect(created[0].nameSetCount).toBe(0);
  });

  it("reads one selected text layer and applies source text while preserving its style", async () => {
    const style = { text: "Existing text", fontSize: 84, fillColor: [1, 0, 0] };
    const selected = createLayer("text", { textDocument: style, name: "Existing text" });
    const { comp } = createComp([selected]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);
    const read = JSON.parse(host.readSelectedTextLayer());
    expect(read).toMatchObject({ ok: true, text: "Existing text" });
    const applied = JSON.parse(host.applyTextLayerEdit(
      encodeURIComponent(JSON.stringify({
        targetId: read.targetId,
        text: "Updated text"
      }))
    ));

    expect(applied).toMatchObject({ ok: true, updatedLayers: 1 });
    expect(selected.textDocument.value).toEqual({
      text: "Updated text",
      fontSize: 84,
      fillColor: [1, 0, 0]
    });
    expect(selected.nameSetCount).toBe(0);
  });

  it("reads keyed source text at the current composition time", async () => {
    const readTimes = [];
    const textDocumentProperty = {
      numKeys: 2,
      value: { text: "Stale text", fontSize: 42 },
      valueAtTime(time) {
        readTimes.push(time);
        return { text: "Current keyed text", fontSize: 84 };
      },
      setValue() {},
      setValueAtTime() {}
    };
    const selected = createLayer("text", {
      textDocumentProperty,
      name: "Animated text"
    });
    const { comp } = createComp([selected]);
    comp.time = 3.25;
    const host = await loadLayerHost({ project: { activeItem: comp } }, TestComp);

    expect(JSON.parse(host.readSelectedTextLayer())).toMatchObject({
      ok: true,
      text: "Current keyed text"
    });
    expect(readTimes).toEqual([3.25]);
  });

  it("applies keyed source text at the current composition time", async () => {
    const staticWrites = [];
    const timedWrites = [];
    const textDocumentProperty = {
      numKeys: 2,
      value: { text: "Stale text", fontSize: 42, fillColor: [1, 0, 0] },
      valueAtTime: () => ({
        text: "Current keyed text",
        fontSize: 84,
        fillColor: [0, 1, 0]
      }),
      setValue(value) { staticWrites.push(value); },
      setValueAtTime(time, value) {
        timedWrites.push({
          time,
          value: { ...value, fillColor: [...value.fillColor] }
        });
      }
    };
    const selected = createLayer("text", {
      textDocumentProperty,
      name: "Animated text"
    });
    const { comp } = createComp([selected]);
    comp.time = 4.5;
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);
    const read = JSON.parse(host.readSelectedTextLayer());

    expect(JSON.parse(host.applyTextLayerEdit(
      encodeURIComponent(JSON.stringify({
        targetId: read.targetId,
        text: "Updated keyed text"
      }))
    ))).toMatchObject({ ok: true, updatedLayers: 1 });
    expect(staticWrites).toEqual([]);
    expect(timedWrites).toEqual([{
      time: 4.5,
      value: {
        text: "Updated keyed text",
        fontSize: 84,
        fillColor: [0, 1, 0]
      }
    }]);
  });

  it("allows Apply to clear an existing text layer", async () => {
    const selected = createLayer("text", {
      textDocument: { text: "Remove me", fontSize: 84 },
      name: "Remove me"
    });
    const { comp } = createComp([selected]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);
    const read = JSON.parse(host.readSelectedTextLayer());

    expect(JSON.parse(host.applyTextLayerEdit(
      encodeURIComponent(JSON.stringify({ targetId: read.targetId, text: "" }))
    ))).toMatchObject({ ok: true, updatedLayers: 1 });
    expect(selected.textDocument.value).toEqual({ text: "", fontSize: 84 });
    expect(JSON.parse(host.createTextLayerFromEditor(
      encodeURIComponent(JSON.stringify({ text: "" }))
    ))).toEqual({ ok: false, reason: "empty-text" });
  });

  it("always creates a new layer after reading instead of changing the target", async () => {
    const style = { text: "Existing text", fontSize: 42 };
    const selected = createLayer("text", { textDocument: style, name: "Existing text" });
    const { comp, created } = createComp([selected]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);

    expect(JSON.parse(host.readSelectedTextLayer()).ok).toBe(true);
    expect(JSON.parse(host.createTextLayerFromEditor(
      encodeURIComponent(JSON.stringify({ text: "New layer" }))
    )).ok).toBe(true);

    expect(created[0].text).toBe("New layer");
    expect(selected.textDocument.value.text).toBe("Existing text");
  });

  it("creates a timed black solid with only a Fill effect and a full-comp adjustment layer", async () => {
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
    expect(solid.effects.added.map((effect) => effect.matchName)).toEqual(["ADBE Fill"]);
    expect(solid.effects.added[0].property("ADBE Fill-0002").value).toEqual([0, 0, 0]);
    expect(solid.effects.added[0].property("ADBE Fill-0002").expression).toBeUndefined();
    expect([solid.inPoint, solid.outPoint]).toEqual([7, 11]);
    expect(solid.movedBefore).toBe(selected);

    expect(JSON.parse(host.runLayerAction(payload("create-adjustment"))).ok).toBe(true);
    expect(created[0].adjustmentLayer).toBe(true);
    expect([created[0].width, created[0].height]).toEqual([1920, 1080]);
  });

  it("keeps a solid at full composition size even when legacy Alt is passed", async () => {
    const selected = createLayer("existing", { index: 2, inPoint: 3, outPoint: 9 });
    const { comp, created } = createComp([selected]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-solid", "alt"))).ok).toBe(true);
    expect([created[0].width, created[0].height]).toEqual([1920, 1080]);
    expect(created[0].transform["ADBE Position"].value).toEqual([0, 0]);
    expect([created[0].inPoint, created[0].outPoint]).toEqual([3, 9]);
  });

  it("ignores the legacy solid-settings modifier", async () => {
    const { comp, created } = createComp([]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-solid", "ctrl"))).ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].effects.added.map((effect) => effect.matchName)).toEqual(["ADBE Fill"]);
  });

  it("places a created layer above the same selected layer after AE reindexes it", async () => {
    const selected = createLayer("existing", { inPoint: 2, outPoint: 8 });
    const { comp, created } = createComp([selected]);
    Object.defineProperty(selected, "index", {
      configurable: true,
      get() { return created.length + 1; }
    });
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-solid"))).ok).toBe(true);
    expect(selected.index).toBe(2);
    expect(created[0].movedBefore).toBe(selected);
    expect(created[0].movedToBeginning).not.toBe(true);
  });

  it("rejects an unknown modifier before opening an undo group", async () => {
    const { comp, created } = createComp([]);
    const undo = [];
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup: () => undo.push("begin"),
      endUndoGroup: () => undo.push("end")
    }, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-text", "meta")))).toEqual({
      ok: false,
      reason: "host-error",
      detail: "invalid-modifier"
    });
    expect(created).toHaveLength(0);
    expect(undo).toEqual([]);
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
    expect(created[0].transform["ADBE Point of Interest"].value).toEqual([960, 540, 0]);
    expect(created[0].transform["ADBE Position"].value).toEqual([960, 540, 0]);
  });
});
