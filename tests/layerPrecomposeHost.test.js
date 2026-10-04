import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

class TestComp {}

function prop(value, options = {}) {
  return {
    value,
    numKeys: options.numKeys ?? 0,
    expression: options.expression ?? "",
    expressionEnabled: options.expressionEnabled ?? false,
    setValue(next) { this.value = next; }
  };
}

function defaultOuter(source, overrides = {}) {
  const transform = {
    "ADBE Anchor Point": prop([source.width / 2, source.height / 2]),
    "ADBE Position": prop([960, 540]),
    "ADBE Scale": prop([100, 100]),
    "ADBE Rotate Z": prop(0),
    "ADBE Orientation": prop([0, 0, 0]),
    "ADBE Opacity": prop(100)
  };
  return {
    name: "Precomp 1",
    index: 2,
    source,
    inPoint: 2,
    outPoint: 8,
    startTime: 2,
    stretch: 100,
    timeRemapEnabled: false,
    threeDLayer: false,
    collapseTransformation: false,
    parent: null,
    hasTrackMatte: false,
    isTrackMatte: false,
    selected: true,
    removed: false,
    transform,
    property(name) {
      if (name === "ADBE Transform Group") {
        return { property: (child) => transform[child] };
      }
      if (name === "ADBE Effect Parade" || name === "ADBE Mask Parade") {
        return { numProperties: 0 };
      }
      return null;
    },
    remove() { this.removed = true; },
    ...overrides
  };
}

function makeComp(selection = []) {
  const layers = [...selection];
  const calls = [];
  const comp = Object.assign(new TestComp(), {
    name: "Main",
    width: 1920,
    height: 1080,
    displayStartTime: 0,
    duration: 10,
    selectedLayers: selection,
    get numLayers() { return layers.length; },
    layer(index) { return layers[index - 1]; }
  });
  comp.layers = {
    precompose(indices, name, moveAllAttributes) {
      calls.push({ indices, name, moveAllAttributes });
      const source = Object.assign(new TestComp(), {
        name,
        width: 1920,
        height: 1080,
        displayStartTime: 0,
        duration: 10,
        numLayers: 0,
        layer() { return null; }
      });
      const layer = defaultOuter(source, { name, index: 1 });
      layers.unshift(layer);
      comp.selectedLayers = [layer];
      return source;
    }
  };
  return { comp, layers, calls };
}

function createApp(comp, projectItems = []) {
  const undo = [];
  return {
    app: {
      project: {
        activeItem: comp,
        numItems: projectItems.length,
        item(index) { return projectItems[index - 1]; }
      },
      beginUndoGroup: (name) => undo.push(`begin:${name}`),
      endUndoGroup: () => undo.push("end")
    },
    undo
  };
}

async function loadRunLayerAction(app) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf("  function decodeLayerActionPayload(encodedPayload) {");
  const end = source.indexOf("  function alignmentActionInfo(action) {", start);
  return Function(
    "app",
    "CompItem",
    "LightType",
    "JSON",
    "decodeURIComponent",
    `${source.slice(start, end)}
return runLayerAction;`
  )(app, TestComp, {}, JSON, decodeURIComponent);
}

function encoded(action, modifier = "none") {
  return encodeURIComponent(JSON.stringify({ action, modifier }));
}

describe("precompose host action", () => {
  it("rejects an empty selection before opening an undo group", async () => {
    const { comp } = makeComp([]);
    const setup = createApp(comp);
    const runLayerAction = await loadRunLayerAction(setup.app);

    expect(JSON.parse(runLayerAction(encoded("precompose-selected")))).toEqual({
      ok: false,
      reason: "no-selected-layer"
    });
    expect(setup.undo).toEqual([]);
  });

  it("sorts selected indices and precomposes with a unique name", async () => {
    const selection = [
      { name: "Bottom", index: 7, inPoint: 0, outPoint: 10 },
      { name: "Hero", index: 2, inPoint: 0, outPoint: 10 }
    ];
    const { comp, calls } = makeComp(selection);
    const setup = createApp(comp, [{ name: "Hero Precomp" }]);
    const runLayerAction = await loadRunLayerAction(setup.app);

    expect(JSON.parse(runLayerAction(encoded("precompose-selected")))).toMatchObject({
      ok: true,
      createdLayers: 1,
      createdItems: 1
    });
    expect(calls).toEqual([{
      indices: [2, 7],
      name: "Hero Precomp 2",
      moveAllAttributes: true
    }]);
    expect(comp.selectedLayers[0].selected).toBe(true);
  });

  it("allows Alt to keep attributes only for a single layer", async () => {
    const single = makeComp([{ name: "Hero", index: 3, inPoint: 0, outPoint: 10 }]);
    const singleSetup = createApp(single.comp);
    const singleRun = await loadRunLayerAction(singleSetup.app);
    expect(JSON.parse(singleRun(encoded("precompose-selected", "alt"))).ok).toBe(true);
    expect(single.calls[0].moveAllAttributes).toBe(false);

    const multi = makeComp([
      { name: "A", index: 1, inPoint: 0, outPoint: 10 },
      { name: "B", index: 2, inPoint: 0, outPoint: 10 }
    ]);
    const multiRun = await loadRunLayerAction(createApp(multi.comp).app);
    expect(JSON.parse(multiRun(encoded("precompose-selected", "alt")))).toMatchObject({
      ok: false,
      reason: "invalid-selection"
    });
    expect(multi.calls).toEqual([]);
  });
});

describe("safe unprecompose host action", () => {
  function createSafeSource(internalCount = 2) {
    const sourceLayers = [];
    const source = Object.assign(new TestComp(), {
      name: "Precomp 1",
      width: 1920,
      height: 1080,
      displayStartTime: 0,
      duration: 6,
      layer(index) { return sourceLayers[index - 1]; }
    });
    Object.defineProperty(source, "numLayers", {
      get() { return sourceLayers.length; }
    });
    for (let index = 0; index < internalCount; index += 1) {
      sourceLayers.push({
        name: `Layer ${index + 1}`,
        matchName: "ADBE AV Layer",
        parent: null,
        hasTrackMatte: false,
        isTrackMatte: false,
        startTime: index,
        inPoint: index,
        outPoint: index + 4,
        copyToComp(targetComp) {
          const copy = {
            name: this.name,
            startTime: this.startTime,
            inPoint: this.inPoint,
            outPoint: this.outPoint,
            selected: false,
            removed: false,
            moveBefore(target) { this.before = target; },
            remove() { this.removed = true; }
          };
          targetComp._layers.unshift(copy);
        }
      });
    }
    return source;
  }

  function makeUnprecompose(source, outerOverrides = {}) {
    const outer = defaultOuter(source, outerOverrides);
    const { comp } = makeComp([outer]);
    comp._layers = [outer];
    Object.defineProperty(comp, "numLayers", { get() { return comp._layers.length; } });
    comp.layer = (index) => comp._layers[index - 1];
    return { comp, outer };
  }

  it("copies simple source layers transactionally and removes the precomp", async () => {
    const source = createSafeSource();
    const { comp, outer } = makeUnprecompose(source);
    const setup = createApp(comp);
    const runLayerAction = await loadRunLayerAction(setup.app);

    expect(JSON.parse(runLayerAction(encoded("unprecompose-selected")))).toMatchObject({
      ok: true,
      createdLayers: 2
    });
    expect(outer.removed).toBe(true);
    const copies = comp._layers.filter((layer) => layer !== outer);
    expect(copies.map((layer) => layer.name)).toEqual(["Layer 1", "Layer 2"]);
    expect(copies.map((layer) => [layer.startTime, layer.inPoint, layer.outPoint])).toEqual([
      [2, 2, 6],
      [3, 3, 7]
    ]);
    expect(copies.every((layer) => layer.selected)).toBe(true);
  });

  it.each([
    ["non-default scale", { transform: { "ADBE Scale": prop([120, 100]) } }],
    ["time remapping", { timeRemapEnabled: true }],
    ["3D outer layer", { threeDLayer: true }],
    ["collapsed transformations", { collapseTransformation: true }],
    ["parented outer layer", { parent: {} }],
    ["track matte dependency", { hasTrackMatte: true }]
  ])("rejects %s without mutating the parent comp", async (_label, overrides) => {
    const source = createSafeSource();
    const base = defaultOuter(source);
    if (overrides.transform) {
      Object.assign(base.transform, overrides.transform);
      delete overrides.transform;
    }
    const { comp, outer } = makeUnprecompose(source, { ...base, ...overrides });
    const runLayerAction = await loadRunLayerAction(createApp(comp).app);

    expect(JSON.parse(runLayerAction(encoded("unprecompose-selected")))).toMatchObject({
      ok: false,
      reason: "unsafe-unprecompose"
    });
    expect(comp._layers).toEqual([outer]);
    expect(outer.removed).toBe(false);
  });

  it("rejects camera content and rolls back copies after a copy failure", async () => {
    const cameraSource = createSafeSource(1);
    cameraSource.layer(1).matchName = "ADBE Camera Layer";
    const cameraSetup = makeUnprecompose(cameraSource);
    const cameraRun = await loadRunLayerAction(createApp(cameraSetup.comp).app);
    expect(JSON.parse(cameraRun(encoded("unprecompose-selected")))).toMatchObject({
      ok: false,
      reason: "unsafe-unprecompose"
    });

    const brokenSource = createSafeSource(2);
    brokenSource.layer(1).copyToComp = () => { throw new Error("copy failed"); };
    const brokenSetup = makeUnprecompose(brokenSource);
    const brokenRun = await loadRunLayerAction(createApp(brokenSetup.comp).app);
    expect(JSON.parse(brokenRun(encoded("unprecompose-selected")))).toMatchObject({
      ok: false,
      reason: "host-error"
    });
    expect(brokenSetup.outer.removed).toBe(false);
    expect(brokenSetup.comp._layers.filter((layer) => layer !== brokenSetup.outer)).toHaveLength(1);
    expect(brokenSetup.comp._layers.find((layer) => layer !== brokenSetup.outer).removed).toBe(true);
  });
});
