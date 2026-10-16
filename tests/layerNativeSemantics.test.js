import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

let nextId = 1;
const prop = value => ({ value, numKeys: 0, expression: "", expressionEnabled: false,
  setValue(next) { this.value = next; } });

// Model collection mutation and startTime side effects, which the older flat
// mocks omitted. This is still NOT the AE expression/render/Undo engine.
function makeLayer(name, options = {}) {
  let start = options.startTime ?? 0;
  let input = options.inPoint ?? 0;
  let output = options.outPoint ?? 10;
  const transform = {
    "ADBE Anchor Point": prop(options.anchor ?? [50, 25]),
    "ADBE Position": prop(options.position ?? [200, 300]),
    "ADBE Scale": prop([100, 100]), "ADBE Rotate Z": prop(0),
    "ADBE Orientation": prop([0, 0, 0]), "ADBE Opacity": prop(100)
  };
  const layer = {
    id: nextId++, name, matchName: "ADBE AV Layer", containingComp: null,
    source: options.source, threeDLayer: options.threeDLayer ?? false,
    selected: false, locked: false, parent: null, stretch: 100,
    enabled: true, audioEnabled: true, blendingMode: "NORMAL",
    trackMatteType: "NO_TRACK_MATTE", numProperties: 0, transform,
    get index() { return this.containingComp._layers.indexOf(this) + 1; },
    get startTime() { return start; },
    set startTime(value) {
      if (this.failTiming) throw new Error("native-timing-failure");
      input += value - start; output += value - start; start = value;
    },
    get inPoint() { return input; }, set inPoint(value) { input = value; },
    get outPoint() { return output; }, set outPoint(value) { output = value; },
    sourceRectAtTime() { return { left: 0, top: 0, width: 100, height: 50 }; },
    property(group) {
      if (group === "ADBE Transform Group") return { property: name => transform[name] ?? null };
      if (group === "ADBE Effect Parade" || group === "ADBE Mask Parade") return { numProperties: 0 };
      return null;
    },
    moveBefore(target) {
      const layers = this.containingComp._layers;
      layers.splice(layers.indexOf(this), 1);
      layers.splice(layers.indexOf(target), 0, this);
    },
    moveToBeginning() {
      const layers = this.containingComp._layers;
      layers.splice(layers.indexOf(this), 1); layers.unshift(this);
    },
    remove() {
      if (this.failRemoval) throw new Error("native-remove-failure");
      const layers = this.containingComp._layers;
      const index = layers.indexOf(this);
      if (index < 0) throw new Error("invalid-layer-handle");
      layers.splice(index, 1);
    },
    setParentWithJump(parent) { this.parent = parent; },
    copyToComp(comp) {
      const copy = makeLayer(this.name, { startTime: start, inPoint: input, outPoint: output,
        source: this.source, position: transform["ADBE Position"].value.slice(),
        anchor: transform["ADBE Anchor Point"].value.slice(), threeDLayer: this.threeDLayer });
      copy.failTiming = this.copyFailsTiming;
      copy.failRemoval = this.copyFailsRemoval;
      comp.add(copy);
      if (this.copyThrowsAfterInsertion) throw new Error("native-copy-failure");
      // copyToComp returns nothing. The inserted copy is at layer(1).
    }
  };
  return layer;
}

class NativeComp {
  constructor(name = "Main", layers = []) {
    this.name = name; this.width = 1920; this.height = 1080; this.pixelAspect = 1;
    this.duration = 20; this.displayStartTime = 0; this.time = 4; this._layers = [];
    this.calls = [];
    layers.forEach(layer => { layer.containingComp = this; this._layers.push(layer); });
    this.layers = {
      precompose: (indices, name, moveAll) => {
        this.calls.push({ indices: indices.slice(), name, moveAll });
        const selected = indices.map(index => this.layer(index));
        const position = Math.min(...indices) - 1;
        const source = new NativeComp(name, selected);
        source.width = this.width; source.height = this.height;
        source.duration = this.duration; source.displayStartTime = this.displayStartTime;
        this._layers = this._layers.filter(layer => !selected.includes(layer));
        const outer = makeLayer(name, { source, anchor: [source.width / 2, source.height / 2],
          position: [this.width / 2, this.height / 2], outPoint: this.duration });
        outer.containingComp = this;
        this._layers.splice(position, 0, outer);
        this.project.items.push(source);
        return source;
      },
      addLight: (name, point) => {
        const light = makeLayer(name, { position: [...point, 0] });
        light.matchName = "ADBE Light Layer";
        light.lightType = "POINT";
        light.transform["ADBE Position"].setValue = function (value) {
          if (light.lightType === "AMBIENT") throw new Error("hidden-property");
          this.value = value;
        };
        // Point of interest only applies to spot/parallel, not ambient/point.
        light.transform["ADBE Point of Interest"] = {
          setValue() { throw new Error("hidden-point-of-interest"); }
        };
        light.transform["ADBE Anchor Point"] = {
          setValue(value) {
            if (!["SPOT", "PARALLEL"].includes(light.lightType)) throw new Error("hidden-point-of-interest");
            this.value = value;
          }
        };
        this.add(light); return light;
      }
    };
  }
  get numLayers() { return this._layers.length; }
  get selectedLayers() { return this._layers.filter(layer => layer.selected); }
  layer(index) { if (!this._layers[index - 1]) throw new Error("invalid-layer-index"); return this._layers[index - 1]; }
  add(layer) { layer.containingComp = this; this._layers.unshift(layer); }
}

async function setup(layers = [], diagnosticFiles) {
  const comp = new NativeComp("Main", layers);
  const project = { activeItem: comp, items: [], get numItems() { return this.items.length; }, item(i) { return this.items[i - 1]; } };
  comp.project = project;
  const undo = [];
  const app = { project, beginUndoGroup: label => undo.push(label), endUndoGroup: () => undo.push("end") };
  const source = await readFile("public/host/index.jsx", "utf8");
  const section = source.slice(source.indexOf("  function decodeLayerActionPayload("), source.indexOf("  function alignmentActionInfo("));
  function FakeFolder(name) { this.fsName = name; this.exists = true; }
  FakeFolder.userData = { fsName: "C:/TestUserData" };
  function FakeFile(name) { this.name = name; this.open = () => true; this.close = () => {};
    this.write = value => diagnosticFiles?.push({ name, value: JSON.parse(value) }); }
  const run = Function("app", "CompItem", "LightType", "File", "Folder", `${section}; return runLayerAction;`)(app, NativeComp,
    { POINT: "POINT", SPOT: "SPOT", PARALLEL: "PARALLEL", AMBIENT: "AMBIENT" }, FakeFile, FakeFolder);
  return { comp, project, undo, run: (action, modifier = "none", languageId = "zh-CN") =>
    JSON.parse(run(encodeURIComponent(JSON.stringify({ action, modifier, languageId })))) };
}

describe("native layer creation boundaries", () => {
  it("removes a newly created light when native initialization fails", async () => {
    const { comp, run } = await setup();
    const add = comp.layers.addLight;
    comp.layers.addLight = (...args) => {
      const light = add(...args); light.failTiming = true; return light;
    };
    expect(run("create-light")).toMatchObject({ ok: false, detail: "light-create-failed" });
    expect(comp.numLayers).toBe(0);
  });

  it("records the failed operation locally without storing project or layer names", async () => {
    const files = [];
    const { comp, run } = await setup([], files);
    const add = comp.layers.addLight;
    comp.layers.addLight = (...args) => { const layer = add(...args); layer.failTiming = true; return layer; };
    expect(run("create-light").ok).toBe(false);
    expect(files).toHaveLength(1);
    expect(files[0].name).toContain("layer-operation-failure.json");
    expect(files[0].value).toMatchObject({ action: "create-light", detail: "light-create-failed", layersAfter: 0 });
    expect(files[0].value).not.toHaveProperty("layerNames");
    expect(files[0].value).not.toHaveProperty("projectPath");
  });
  it.each(["none", "alt", "ctrl", "shift"])("creates %s light without touching hidden native properties", async modifier => {
    const { comp, run } = await setup();
    expect(run("create-light", modifier).ok).toBe(true);
    expect(comp.numLayers).toBe(1);
    expect(comp.layer(1).selected).toBe(true);
  });

  it.each([
    ["zh-CN", ["Nya 点光", "Nya 聚光", "Nya 平行光", "Nya 环境光"]],
    ["zh-TW", ["Nya 點光", "Nya 聚光", "Nya 平行光", "Nya 環境光"]],
    ["en", ["Nya Point Light", "Nya Spot Light", "Nya Parallel Light", "Nya Ambient Light"]],
    ["ja", ["Nya ポイントライト", "Nya スポットライト", "Nya 平行ライト", "Nya アンビエントライト"]],
    ["ko", ["Nya 포인트 조명", "Nya 스포트 조명", "Nya 평행 조명", "Nya 주변광"]]
  ])("names each %s light by type, incrementing only the matching type", async (language, names) => {
    const { comp, run } = await setup();
    for (const [index, modifier] of ["none", "alt", "ctrl", "shift"].entries()) {
      expect(run("create-light", modifier, language).ok).toBe(true);
      expect(comp.layer(1).name).toBe(names[index]);
    }
    expect(run("create-light", "shift", language).ok).toBe(true);
    expect(comp.layer(1).name).toBe(`${names[3]} 2`);
  });
});

describe("precompose with real children and coupled timing", () => {
  it("keeps the approved fitted duration while offsetting child time exactly once", async () => {
    const a = makeLayer("A", { inPoint: 6, outPoint: 18 });
    const b = makeLayer("B", { inPoint: 8, outPoint: 12 });
    a.selected = b.selected = true;
    const { comp, run } = await setup([a, b]);
    expect(run("precompose-selected").ok).toBe(true);
    const outer = comp.layer(1);
    expect([outer.inPoint, outer.outPoint, outer.source.duration]).toEqual([6, 18, 12]);
    expect([a.inPoint, a.outPoint, b.inPoint, b.outPoint]).toEqual([0, 12, 2, 6]);
  });

  it("Ctrl creates one timed precomp per selected layer in the original order", async () => {
    const a = makeLayer("Same", { inPoint: 2, outPoint: 8 });
    const middle = makeLayer("Unselected");
    const b = makeLayer("Same", { inPoint: 4, outPoint: 12 });
    a.selected = b.selected = true;
    const { comp, run, undo } = await setup([a, middle, b]);
    expect(run("precompose-selected", "ctrl")).toMatchObject({ ok: true, createdLayers: 2, createdItems: 2 });
    expect(comp.layer(2)).toBe(middle);
    expect(comp.selectedLayers).toHaveLength(2);
    expect(comp.layer(1).source.layer(1)).toBe(a);
    expect(comp.layer(3).source.layer(1)).toBe(b);
    expect([comp.layer(1).source.duration, comp.layer(3).source.duration]).toEqual([6, 8]);
    expect(new Set(comp.selectedLayers.map(layer => layer.name)).size).toBe(2);
    expect(undo).toHaveLength(2);
  });

  it("Shift moves all attributes while preserving the full composition duration", async () => {
    const layer = makeLayer("A", { inPoint: 6, outPoint: 18 }); layer.selected = true;
    const { comp, run } = await setup([layer]);
    expect(run("precompose-selected", "shift").ok).toBe(true);
    expect(comp.calls[0].moveAll).toBe(true);
    expect(comp.layer(1).source.duration).toBe(20);
    expect([layer.inPoint, layer.outPoint]).toEqual([6, 18]);
  });

  it("crops real 2D children without changing their resulting main-comp positions", async () => {
    const a = makeLayer("A", { position: [200, 300], inPoint: 2, outPoint: 8 });
    const b = makeLayer("B", { position: [500, 400], inPoint: 4, outPoint: 9 });
    a.selected = b.selected = true;
    const { comp, run } = await setup([a, b]);
    expect(run("precompose-selected", "alt").ok).toBe(true);
    const outer = comp.layer(1), source = outer.source;
    expect([source.width, source.height]).toEqual([400, 150]);
    const offset = outer.transform["ADBE Position"].value.map((x, i) => x - outer.transform["ADBE Anchor Point"].value[i]);
    expect(a.transform["ADBE Position"].value.map((x, i) => x + offset[i])).toEqual([200, 300]);
    expect(b.transform["ADBE Position"].value.map((x, i) => x + offset[i])).toEqual([500, 400]);
    expect([a.inPoint, a.outPoint, b.inPoint, b.outPoint]).toEqual([0, 6, 2, 7]);
  });

  it("rejects 3D crop before precompose instead of using projected pixels as 3D offsets", async () => {
    const layer = makeLayer("3D", { threeDLayer: true, position: [200, 300, 400] });
    layer.sourcePointToComp = point => [point[0] + 150, point[1] + 275];
    layer.selected = true;
    const { comp, run } = await setup([layer]);
    expect(run("precompose-selected", "alt")).toMatchObject({ ok: false, detail: "precomp-crop-3d-unsupported" });
    expect(comp.calls).toHaveLength(0);
    expect(comp.layer(1)).toBe(layer);
  });

  it("uses native 2D transforms rather than text source conversion for shape crop", async () => {
    const layer = makeLayer("Shape", { position: [200, 300] });
    layer.sourcePointToComp = () => { throw new Error("not-a-text-layer"); };
    layer.selected = true;
    const { comp, run } = await setup([layer]);
    expect(run("precompose-selected", "alt").ok).toBe(true);
    expect(comp.layer(1).transform["ADBE Position"].value).toEqual([200, 300]);
  });

  it("includes shape extents when deriving crop bounds", async () => {
    const layer = makeLayer("Outlined shape", { position: [200, 300] });
    layer.selected = true;
    layer.sourceRectAtTime = (_time, includeExtents) => includeExtents
      ? { left: -5, top: -5, width: 110, height: 60 }
      : { left: 0, top: 0, width: 100, height: 50 };
    const { comp, run } = await setup([layer]);
    expect(run("precompose-selected", "alt").ok).toBe(true);
    expect([comp.layer(1).source.width, comp.layer(1).source.height]).toEqual([110, 60]);
  });

  it("preflights the whole Ctrl batch before moving a layer with a parent dependency", async () => {
    const a = makeLayer("Parent"), b = makeLayer("Child");
    b.parent = a; a.selected = b.selected = true;
    const { comp, run } = await setup([a, b]);
    expect(run("precompose-selected", "ctrl")).toMatchObject({ ok: false, detail: "precomp-individual-dependency" });
    expect(comp.calls).toHaveLength(0);
  });

  it("rejects the removed settings mode without changing the comp", async () => {
    const layer = makeLayer("A"); layer.selected = true;
    const { comp, run } = await setup([layer]);
    expect(run("precompose-selected", "settings")).toMatchObject({ ok: false, detail: "invalid-modifier" });
    expect(comp.calls).toHaveLength(0);
  });
});

describe("unprecompose atomicity with native collection changes", () => {
  async function extraction() {
    const a = makeLayer("A", { inPoint: 0, outPoint: 6 });
    const b = makeLayer("B", { startTime: 1, inPoint: 2, outPoint: 5 });
    const source = new NativeComp("Source", [a, b]); source.duration = 6;
    const outer = makeLayer("Outer", { source, startTime: 4, inPoint: 4, outPoint: 10,
      anchor: [960, 540], position: [960, 540] }); outer.selected = true;
    return { ...await setup([outer]), a, b, source, outer };
  }

  it("extracts every layer once, preserves exact time/order, removes only the outer layer", async () => {
    const { comp, run, source } = await extraction();
    expect(run("unprecompose-selected")).toMatchObject({ ok: true, createdLayers: 2 });
    expect(comp._layers.map(layer => layer.name)).toEqual(["A", "B"]);
    expect(comp._layers.map(layer => [layer.startTime, layer.inPoint, layer.outPoint])).toEqual([[4, 4, 10], [5, 6, 9]]);
    expect(source.numLayers).toBe(2);
    expect(comp.selectedLayers).toHaveLength(2);
  });

  it("removes ALL new layers when the later copy throws after insertion", async () => {
    const { comp, run, a, outer } = await extraction(); a.copyThrowsAfterInsertion = true;
    expect(run("unprecompose-selected").ok).toBe(false);
    expect(comp._layers).toEqual([outer]);
    expect(comp.selectedLayers).toEqual([outer]);
  });

  it("restores internal parenting without compensation or applying the outer offset twice", async () => {
    const { comp, run, source, a, b, outer } = await extraction();
    b.parent = a;
    outer.transform["ADBE Position"].setValue([1000, 560]);
    expect(run("unprecompose-selected").ok).toBe(true);
    expect(comp.layer(2).parent).toBe(comp.layer(1));
    expect(comp.layer(1).transform["ADBE Position"].value).toEqual([240, 320]);
    expect(comp.layer(2).transform["ADBE Position"].value).toEqual([200, 300]);
    expect(source.layer(2).parent).toBe(a);
  });

  it("explicitly reports failed cleanup rather than hiding a retained partial copy", async () => {
    const { comp, run, b, outer } = await extraction();
    b.copyFailsTiming = b.copyFailsRemoval = true;
    expect(run("unprecompose-selected")).toMatchObject({ ok: false, detail: "unprecompose-rollback-failed" });
    expect(comp._layers).toContain(outer);
    expect(comp.numLayers).toBe(2);
  });
});
