import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { LAYER_DISPLAY_NAMES, getLayerDisplayName } from "../src/layers/layerDisplayNames";
import { LANGUAGE_IDS } from "../src/i18n/languages";

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
  createTextLayerFromEditor: createTextLayerFromEditor,
  decodeLayerActionPayload: decodeLayerActionPayload,
  resolveLayerLanguage: typeof resolveLayerLanguage === "function" ? resolveLayerLanguage : null,
  getLayerDisplayName: typeof getLayerDisplayName === "function" ? getLayerDisplayName : null
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
    layer(index) { return [...created, ...selectedLayers][index - 1]; }
  });
  // Object.assign evaluates a getter once. Keep numLayers live so selection
  // clearing includes existing layers after a new layer has been inserted.
  Object.defineProperty(comp, "numLayers", {
    get() { return selectedLayers.length + created.length; }
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
  it.each([
    ["zh-CN", "Nya 调整层"], ["zh-TW", "Nya 調整圖層"], ["en", "Nya Adjustment"],
    ["ja", "Nya 調整レイヤー"], ["ko", "Nya 조정 레이어"]
  ])("creates a unique %s adjustment with unchanged dimensions, timing, selection and Undo", async (languageId, name) => {
    const first = createLayer("existing", { name, index: 6, inPoint: 8, outPoint: 12 });
    const second = createLayer("existing", { name: `${name} 2`, index: 2, inPoint: 6, outPoint: 18 });
    first.selected = second.selected = true;
    const { comp, created } = createComp([first, second]);
    comp.pixelAspect = 1.5;
    const undo = [];
    const host = await loadLayerHost({ project: { activeItem: comp },
      beginUndoGroup: name => undo.push(name), endUndoGroup: () => undo.push("end") }, TestComp);
    expect(JSON.parse(host.runLayerAction(encodeURIComponent(JSON.stringify({
      action: "create-adjustment", languageId
    }))))).toEqual({ ok: true, createdLayers: 1, updatedLayers: 0, createdItems: 0 });
    expect(created[0]).toMatchObject({ name: `${name} 3`, adjustmentLayer: true,
      width: 1920, height: 1080, pixelAspect: 1.5, duration: 20,
      startTime: 6, inPoint: 6, outPoint: 18, selected: true });
    expect(created[0].effects.added).toEqual([]);
    expect(created[0].movedBefore).toBe(second);
    expect(first.selected).toBe(false);
    expect(second.selected).toBe(false);
    expect([first.name, second.name]).toEqual([name, `${name} 2`]);
    expect(undo).toEqual(["NYAWORKS Create Layer", "end"]);
  });

  it.each([
    ["create-solid", "zh-CN", "Nya 纯色"], ["create-solid", "en", "Nya Solid"],
    ["create-light", "zh-CN", "Nya 灯光"], ["create-light", "ja", "Nya ライト"],
    ["create-text", "zh-CN", "text"], ["create-text", "en", "text"]
  ])("localizes %s in %s without changing timing, insertion or effect lists", async (action, languageId, name) => {
    const selected = createLayer("existing", { name: "Keep me", index: 2, inPoint: 7, outPoint: 11 });
    const { comp, created } = createComp([selected]);
    const host = await loadLayerHost({ project: { activeItem: comp }, beginUndoGroup() {}, endUndoGroup() {} }, TestComp, { POINT: "POINT" });
    expect(JSON.parse(host.runLayerAction(encodeURIComponent(JSON.stringify({ action, languageId })))).ok).toBe(true);
    expect(created[0]).toMatchObject({ name, startTime: 7, inPoint: 7, outPoint: 11, selected: true });
    expect(created[0].movedBefore).toBe(selected);
    expect(selected.name).toBe("Keep me");
    expect(selected.nameSetCount).toBe(0);
    expect(created[0].effects.added.map(effect => effect.matchName)).toEqual(action === "create-solid" ? ["ADBE Fill"] : []);
    if (action === "create-solid") {
      expect(created[0]).toMatchObject({ color: [0, 0, 0], width: 1920, height: 1080, pixelAspect: 1 });
    } else if (action === "create-light") {
      expect(created[0].lightType).toBe("POINT");
      expect(created[0].transform["ADBE Position"].value).toEqual([960, 540, 0]);
    } else {
      expect(created[0].text).toBe("text");
      expect(created[0].nameSetCount).toBe(0);
      expect(created[0].transform["ADBE Position"].value).toEqual([960, 540]);
    }
  });

  it("exposes the stable ordinary naming contract without mutating the composition", async () => {
    const { comp, created } = createComp([]);
    const host = await loadLayerHost({ project: { activeItem: comp } }, TestComp);
    expect(host.resolveLayerLanguage).toBeTypeOf("function");
    expect(host.getLayerDisplayName).toBeTypeOf("function");
    expect(host.resolveLayerLanguage()).toBe("zh-CN");
    expect(host.decodeLayerActionPayload(payload("create-adjustment")).languageId).toBe("zh-CN");
    for (const invalid of [null, 1, {}, [], "en-US", "constructor", "__proto__"]) {
      expect(host.resolveLayerLanguage(invalid)).toBe("zh-CN");
      expect(host.decodeLayerActionPayload(encodeURIComponent(JSON.stringify({
        action: "create-adjustment", languageId: invalid
      }))).languageId).toBe("zh-CN");
    }
    expect(host.getLayerDisplayName("adjustment", "en")).toBe("Nya Adjustment");
    expect(host.getLayerDisplayName("solid", "zh-CN")).toBe("Nya 纯色");
    for (const objectId of Object.keys(LAYER_DISPLAY_NAMES)) {
      for (const languageId of LANGUAGE_IDS) {
        expect(host.getLayerDisplayName(objectId, languageId)).toBe(getLayerDisplayName(objectId, languageId));
      }
    }
    expect(() => host.getLayerDisplayName("constructor", "en")).toThrow("unknown-layer-object");
    expect(created).toEqual([]);
  });

  it.each([undefined, "zh-CN", "unsupported", null, 42, {}, []].map(languageId => ({ languageId })))(
    "preserves the exact adjustment baseline for missing, Chinese or malformed language $languageId",
    async ({ languageId }) => {
      const selected = createLayer("existing", { name: "Untouched", index: 3, inPoint: 7, outPoint: 11 });
      selected.selected = true;
      const { comp, created } = createComp([selected]);
      const undo = [];
      const host = await loadLayerHost({
        project: { activeItem: comp },
        beginUndoGroup: (name) => undo.push(name), endUndoGroup: () => undo.push("end")
      }, TestComp);
      const result = JSON.parse(host.runLayerAction(encodeURIComponent(JSON.stringify({
        action: "create-adjustment", modifier: "none", languageId
      }))));
      expect(result).toEqual({ ok: true, createdLayers: 1, updatedLayers: 0, createdItems: 0 });
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        name: "Nya 调整层", adjustmentLayer: true, width: 1920, height: 1080,
        pixelAspect: 1, duration: 20, startTime: 7, inPoint: 7, outPoint: 11, selected: true
      });
      expect(created[0].movedBefore).toBe(selected);
      expect(created[0].effects.added).toEqual([]);
      expect(selected.name).toBe("Untouched");
      expect(selected.nameSetCount).toBe(0);
      expect(selected.selected).toBe(false);
      expect(undo).toEqual(["NYAWORKS Create Layer", "end"]);
    }
  );

  it("uses the English adjustment name when explicitly requested", async () => {
    const { comp, created } = createComp([]);
    const host = await loadLayerHost({
      project: { activeItem: comp }, beginUndoGroup() {}, endUndoGroup() {}
    }, TestComp);
    expect(JSON.parse(host.runLayerAction(encodeURIComponent(JSON.stringify({
      action: "create-adjustment", modifier: "none", languageId: "en"
    })))).ok).toBe(true);
    expect(created[0].name).toBe("Nya Adjustment");
    expect(created[0].effects.added).toEqual([]);
  });

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

  it("creates a uniquely named adjustment layer with the shared timing and insertion rules", async () => {
    const selected = createLayer("existing", {
      index: 4,
      inPoint: 2.5,
      outPoint: 8.75,
      name: "Nya 调整层"
    });
    const { comp, created } = createComp([selected]);
    const host = await loadLayerHost({
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    }, TestComp);

    expect(JSON.parse(host.runLayerAction(payload("create-adjustment")))).toMatchObject({
      ok: true,
      createdLayers: 1,
      updatedLayers: 0,
      createdItems: 0
    });

    const adjustment = created[0];
    expect(adjustment.name).toBe("Nya 调整层 2");
    expect(adjustment.adjustmentLayer).toBe(true);
    expect([adjustment.width, adjustment.height]).toEqual([1920, 1080]);
    expect([adjustment.inPoint, adjustment.outPoint]).toEqual([2.5, 8.75]);
    expect(adjustment.movedBefore).toBe(selected);
    expect(adjustment.selected).toBe(true);
    expect(adjustment.effects.added).toEqual([]);
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
