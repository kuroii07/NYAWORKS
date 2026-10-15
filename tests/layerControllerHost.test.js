import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

class TestComp {}

function prop(value) {
  return {
    value,
    expression: "",
    expressionEnabled: false,
    setValue(next) { this.value = next; }
  };
}

function createLayer(kind, options = {}) {
  const transform = {
    "ADBE Anchor Point": prop(options.anchor ?? [0, 0]),
    "ADBE Position": prop(options.position ?? [0, 0]),
    ...(kind === "camera" ? {} : { "ADBE Point of Interest": prop([0, 0, 0]) }),
    "ADBE Rotate X": prop(0),
    "ADBE Rotate Y": prop(0),
    "ADBE Rotate Z": prop(options.rotation ?? 0),
    "ADBE Scale": prop(options.scale ?? [100, 100, 100])
  };
  const cameraOptions = {
    "ADBE Camera Zoom": prop(1000),
    "ADBE Camera Depth of Field": prop(0),
    "ADBE Camera Focus Distance": prop(1000)
  };
  const controls = [];
  const effects = {
    get numProperties() { return controls.length; },
    property(index) { return controls[index - 1] ?? null; },
    addProperty(matchName) {
      const control = {
        matchName,
        name: "",
        value: prop(null),
        property() { return this.value; }
      };
      controls.push(control);
      return control;
    }
  };
  let parent = options.parent ?? null;
  return {
    kind,
    name: options.name ?? kind,
    index: options.index ?? 1,
    inPoint: options.inPoint ?? 0,
    outPoint: options.outPoint ?? 10,
    width: options.width ?? 100,
    height: options.height ?? 100,
    locked: options.locked ?? false,
    threeDLayer: options.threeDLayer ?? false,
    guideLayer: false,
    selected: options.selected ?? false,
    controls,
    applyPreset(file, fromSelection = false) {
      if (options.presetOptions?.throwOnApply) throw new Error("preset-apply-failed");
      if (!fromSelection && options.presetOptions?.selectedLayersAtApply) {
        options.presetOptions.selectedLayersAtApply().forEach(layer => layer.applyPreset(file, true));
        return;
      }
      const locale = file.fsName.includes("/zh-TW/") ? "zh-TW" :
        file.fsName.includes("/en/") ? "en" : file.fsName.includes("/ja/") ? "ja" : "zh-CN";
      const names = {
        "zh-CN": ["Nya 摄像机控制", "Pseudo/NYA_Camera_v3_zhCN_r2"],
        "zh-TW": ["Nya 攝影機控制", "Pseudo/NYA_Camera_v3_zhTW_r2"],
        en: ["Nya Camera Control", "Pseudo/NYA_Camera_v3_en_r2"],
        ja: ["Nya カメラコントロール", "Pseudo/NYA_Camera_v3_ja_r3"]
      };
      const [name, matchName] = names[locale];
      const indices = [2, 5, 6, 7, 8, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26];
      const defaults = [0, 0, 0, 0, 0, 0, 0, 0, 0, 35, 0, 0, 1000, 0, 2];
      const properties = Array.from({ length: 27 }, (_, offset) => ({
        name: offset === 26 ? "__NYA_CAMERA_V3__" : "",
        matchName: `${matchName}-${String(offset + 1).padStart(4, "0")}`,
        propertyValueType: offset === 1 ? 6421 : indices.includes(offset + 1) ? 6417 : 6412,
        value: defaults[indices.indexOf(offset + 1)],
        setValue(next) {
          if (offset === 1 && options.presetOptions?.hiddenTarget) throw new Error("property-or-parent-hidden");
          this.value = options.presetOptions?.roundCameraPosition && [5, 6, 7].includes(offset + 1)
            ? Math.round(next * 100) / 100
            : next;
        }
      }));
      if (options.presetOptions?.badSignature) properties[26].name = "wrong marker";
      if (options.presetOptions?.badLayerType) properties[1].propertyValueType = 6417;
      const effect = {
        name, matchName, propertyIndex: controls.length + 1,
        property(index) { return properties[index - 1] ?? null; },
        remove() { controls.splice(controls.indexOf(this), 1); }
      };
      controls.push(effect);
    },
    transform,
    cameraOptions,
    get parent() { return parent; },
    set parent(value) {
      if (value && options.failParent) throw new Error("parent-assignment-failed");
      const separated = transform["ADBE Position"].dimensionsSeparated;
      const current = separated
        ? [transform["ADBE Position_0"].value, transform["ADBE Position_1"].value]
        : transform["ADBE Position"].value;
      const previousOffset = parent?.transform["ADBE Position"].value ?? [0, 0, 0];
      const nextOffset = value?.transform["ADBE Position"].value ?? [0, 0, 0];
      const compensated = current.map((coordinate, index) => coordinate + (previousOffset[index] ?? 0) - (nextOffset[index] ?? 0));
      if (separated) {
        compensated.forEach((value, index) => { transform[`ADBE Position_${index}`].value = value; });
      } else transform["ADBE Position"].value = compensated;
      parent = value;
    },
    moveBefore(target) { this.movedBefore = target; },
    moveToBeginning() { this.movedToBeginning = true; },
    property(name) {
      if (name === "ADBE Transform Group") {
        return { property: (child) => transform[child] };
      }
      if (name === "ADBE Effect Parade") return effects;
      if (name === "ADBE Camera Options Group") {
        return { property: (child) => cameraOptions[child] };
      }
      return null;
    }
  };
}

function createApp(selection = [], presetOptions = {}) {
  const created = [];
  const comp = Object.assign(new TestComp(), {
    width: 1920,
    height: 1080,
    pixelAspect: 1,
    displayStartTime: 0,
    duration: 10,
    selectedLayers: selection,
    layer(index) { return [...created, ...selection][index - 1]; }
  });
  Object.defineProperty(comp, "numLayers", { get: () => created.length + selection.length });
  selection.forEach(layer => { layer.selected = true; });
  Object.defineProperty(comp, "selectedLayers", {
    get: () => [...created, ...selection].filter(layer => layer.selected)
  });
  if (presetOptions.autoSelectNewLayers) {
    presetOptions.selectedLayersAtApply = () => comp.selectedLayers;
  }
  comp.layers = {
    addNull() {
      const layer = createLayer("null", { name: "Null", presetOptions });
      layer.remove = () => created.splice(created.indexOf(layer), 1);
      created.unshift(layer);
      if (presetOptions.autoSelectNewLayers) layer.selected = true;
      return layer;
    },
    addCamera(name, point) {
      const layer = createLayer("camera", { name, position: [point[0], point[1], -1000], anchor: [point[0], point[1], 0] });
      layer.remove = () => created.splice(created.indexOf(layer), 1);
      layer.point = point;
      created.unshift(layer);
      if (presetOptions.autoSelectNewLayers) layer.selected = true;
      return layer;
    }
  };
  return {
    app: {
      project: { activeItem: comp },
      undoBegins: 0,
      undoEnds: 0,
      beginUndoGroup() { this.undoBegins++; },
      endUndoGroup() { this.undoEnds++; }
    },
    comp,
    created
  };
}

async function loadRunLayerAction(app, presetOptions = {}) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const catalog = await readFile("public/host/pseudo-effects/catalog.json", "utf8");
  function TestFile(path) {
    this.fsName = path;
    this.exists = !presetOptions.missingPreset &&
      (path.endsWith("/catalog.json") ||
        /\/(camera-zh-CN|(?:en|zh-TW|ja)\/camera)\.ffx$/.test(path));
    this.open = () => this.exists;
    this.read = () => presetOptions.catalogOverride || catalog;
    this.close = () => {};
  }
  const start = source.indexOf("  function decodeLayerActionPayload(encodedPayload) {");
  const end = source.indexOf("  function alignmentActionInfo(action) {", start);
  return Function(
    "app",
    "CompItem",
    "LightType",
    "JSON",
    "decodeURIComponent",
    "File",
    `${source.slice(start, end)}
return runLayerAction;`
  )(app, TestComp, {}, JSON, decodeURIComponent, TestFile);
}

function encoded(action, modifier = "none", languageId) {
  return encodeURIComponent(JSON.stringify({
    action, modifier, languageId,
    ...(action === "create-camera-rig" ? { extensionRoot: "C:/CEP/NYAWORKS" } : {})
  }));
}

function worldAnchor(layer) {
  const offset = layer.parent?.transform["ADBE Position"].value ?? [0, 0, 0];
  const value = layer.transform["ADBE Position"].dimensionsSeparated
    ? [layer.transform["ADBE Position_0"].value, layer.transform["ADBE Position_1"].value]
    : layer.transform["ADBE Position"].value;
  return value.map((value, index) => value + (offset[index] ?? 0));
}

describe("null controller host action", () => {
  it("supports static separated Position without reading its inactive leader or followers", async () => {
    const target = createLayer("shape", { position: [0, 0] });
    target.transform["ADBE Position"].dimensionsSeparated = true;
    Object.defineProperty(target.transform["ADBE Position"], "value", { get() { throw new Error("inactive-leader"); } });
    target.transform["ADBE Position_0"] = prop(400);
    target.transform["ADBE Position_1"] = prop(300);
    const { app, created } = createApp([target]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null"))).ok).toBe(true);
    expect(created[0].transform["ADBE Position"].value).toEqual([450, 350]);
    expect(worldAnchor(target)).toEqual([400, 300]);
  });

  it("covers timing union, uppermost insertion, guide anchor and one Undo group", async () => {
    const first = createLayer("shape", { index: 5, inPoint: 12, outPoint: 17 });
    const second = createLayer("shape", { index: 2, inPoint: 14, outPoint: 19 });
    const { app, created } = createApp([first, second]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null")))).toMatchObject({ ok: true, createdLayers: 1, updatedLayers: 2 });
    expect([created[0].startTime, created[0].inPoint, created[0].outPoint]).toEqual([12, 12, 19]);
    expect(created[0].movedBefore).toBe(second);
    expect(created[0].transform["ADBE Anchor Point"].value).toEqual([50, 50]);
    expect([app.undoBegins, app.undoEnds]).toEqual([1, 1]);
  });

  it("reports an incomplete rollback instead of claiming recovery", async () => {
    const target = createLayer("shape", { failParent: true });
    const { app, comp } = createApp([target]);
    const originalAdd = comp.layers.addNull;
    comp.layers.addNull = () => {
      const layer = originalAdd();
      layer.remove = () => { throw new Error("remove-failed"); };
      return layer;
    };
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null")))).toMatchObject({ ok: false, detail: "null-rollback-failed" });
    expect([app.undoBegins, app.undoEnds]).toEqual([1, 1]);
  });

  it("removes previously completed Alt controllers if the next addNull fails", async () => {
    const targets = [createLayer("shape", { position: [100, 200] }), createLayer("text", { position: [300, 400] })];
    const { app, comp, created } = createApp(targets);
    const originalAdd = comp.layers.addNull;
    let calls = 0;
    comp.layers.addNull = () => { if (++calls === 2) throw new Error("add-failed"); return originalAdd(); };
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null", "alt")))).toMatchObject({ ok: false, detail: "null-create-failed" });
    expect(created).toHaveLength(0);
    expect(targets.map(worldAnchor)).toEqual([[100, 200], [300, 400]]);
    expect(targets.every(layer => !layer.parent && layer.selected)).toBe(true);
  });

  it("distinguishes visual selection bounds from Ctrl anchor average", async () => {
    for (const [modifier, expected] of [["none", [350, 200]], ["ctrl", [250, 150]]]) {
      const first = createLayer("shape", { position: [100, 100], width: 300, height: 200 });
      const second = createLayer("text", { index: 2, position: [400, 200], width: 200, height: 100 });
      const { app, created } = createApp([first, second]);
      const run = await loadRunLayerAction(app);
      expect(JSON.parse(run(encoded("create-null", modifier))).ok).toBe(true);
      expect(created[0].transform["ADBE Position"].value).toEqual(expected);
      expect([first, second].map(worldAnchor)).toEqual([[100, 100], [400, 200]]);
      expect([first.selected, second.selected]).toEqual([false, false]);
    }
  });

  it("uses rotated/scaled 2D bounds with noncentral anchors", async () => {
    const target = createLayer("shape", { position: [400, 300], width: 200, height: 100, scale: [200, 100], rotation: 90 });
    const { app, created } = createApp([target]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null"))).ok).toBe(true);
    expect(created[0].transform["ADBE Position"].value[0]).toBeCloseTo(350);
    expect(created[0].transform["ADBE Position"].value[1]).toBeCloseTo(500);
    expect(worldAnchor(target)).toEqual([400, 300]);
  });

  it.each(["none", "shift", "ctrl"])("keeps mixed 2D/3D anchors in world space for %s", async modifier => {
    const first = createLayer("shape", { position: [100, 200] });
    const second = createLayer("shape", { index: 2, position: [300, 400, 80], threeDLayer: true });
    const { app, created } = createApp([first, second]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null", modifier))).ok).toBe(true);
    expect(created[0].threeDLayer).toBe(true);
    expect(created[0].transform["ADBE Position"].value).toEqual([200, 300, 40]);
    expect([first, second].map(worldAnchor)).toEqual([[100, 200], [300, 400, 80]]);
  });

  it.each(["ADBE Position", "ADBE Scale", "ADBE Rotate Z"])("rejects animated %s before mutation", async name => {
    const target = createLayer("shape");
    target.transform[name].numKeys = 2;
    const { app, created } = createApp([target]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null")))).toMatchObject({ ok: false, reason: "invalid-selection", detail: "null-unsafe-transform" });
    expect(created).toHaveLength(0);
    expect(target.parent).toBeNull();
    expect(target.selected).toBe(true);
  });

  it("rejects active expressions and separated animated axes before mutation", async () => {
    for (const separated of [false, true]) {
      const target = createLayer("shape");
      if (separated) {
        target.transform["ADBE Position"].dimensionsSeparated = true;
        target.transform["ADBE Position_0"] = prop(100);
        target.transform["ADBE Position_0"].numKeys = 1;
        target.transform["ADBE Position_1"] = prop(200);
      } else {
        target.transform["ADBE Position"].expression = "wiggle(2, 10)";
        target.transform["ADBE Position"].expressionEnabled = true;
      }
      const { app, created } = createApp([target]);
      const run = await loadRunLayerAction(app);
      expect(JSON.parse(run(encoded("create-null", "alt")))).toMatchObject({ ok: false, detail: "null-unsafe-transform" });
      expect(created).toHaveLength(0);
    }
  });

  it.each(["none", "alt"])("rolls back parents, local transforms, selection and all created Nulls after %s failure", async modifier => {
    const first = createLayer("shape", { position: [100, 200], index: 2 });
    const second = createLayer("shape", { position: [300, 400], failParent: true });
    const { app, created } = createApp([first, second]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null", modifier))).ok).toBe(false);
    expect(created).toHaveLength(0);
    expect([first.parent, second.parent]).toEqual([null, null]);
    expect([first, second].map(worldAnchor)).toEqual([[100, 200], [300, 400]]);
    expect([first.selected, second.selected]).toEqual([true, true]);
  });

  it("rejects nonfinite positions rather than substituting zero", async () => {
    const { app, created } = createApp([createLayer("shape", { position: [NaN, 20] })]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null", "alt")))).toMatchObject({ ok: false, detail: "null-position-unavailable" });
    expect(created).toHaveLength(0);
  });

  it("cleans a Null when initialization itself fails", async () => {
    const { app, comp, created } = createApp();
    const originalAdd = comp.layers.addNull;
    comp.layers.addNull = () => {
      const layer = originalAdd();
      layer.transform["ADBE Anchor Point"].setValue = () => { throw new Error("null-init-failed"); };
      return layer;
    };
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-null"))).ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it.each([["zh-CN", "Nya 控制"], ["zh-TW", "Nya 控制"], ["en", "Nya Control"], ["ja", "Nya コントロール"], ["ko", "Nya 컨트롤"]])(
    "localizes %s per-layer nulls without changing parenting, position or timing", async (languageId, name) => {
      const first = createLayer("shape", { name: "First", index: 2, position: [100, 200], inPoint: 2, outPoint: 6 });
      const second = createLayer("text", { name: "Second", index: 1, position: [300, 400], inPoint: 4, outPoint: 8 });
      const { app, created } = createApp([first, second]);
      const run = await loadRunLayerAction(app);
      expect(JSON.parse(run(encoded("create-null", "alt", languageId)))).toEqual({
        ok: true, createdLayers: 2, updatedLayers: 2, createdItems: 0
      });
      expect(first.parent.name).toBe(name);
      expect(second.parent.name).toBe(`${name} 2`);
      expect(created.every(layer => layer.guideLayer && layer.selected)).toBe(true);
      expect([first.parent.inPoint, first.parent.outPoint]).toEqual([2, 6]);
      expect([second.parent.inPoint, second.parent.outPoint]).toEqual([4, 8]);
      expect([first.name, second.name]).toEqual(["First", "Second"]);
      expect([first, second].map(worldAnchor)).toEqual([[100, 200], [300, 400]]);
    }
  );
  it("creates a centered guide null when nothing is selected", async () => {
    const { app, created } = createApp();
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-null")))).toMatchObject({
      ok: true,
      createdLayers: 1
    });
    expect(created[0]).toMatchObject({
      name: "Nya 控制",
      guideLayer: true,
      threeDLayer: false,
      selected: true
    });
    expect(created[0].transform["ADBE Anchor Point"].value).toEqual([50, 50]);
    expect(created[0].transform["ADBE Position"].value).toEqual([960, 540]);
  });

  it("adds a numeric suffix when the controller name already exists", async () => {
    const existing = createLayer("null", { name: "Nya 控制" });
    const { app, created } = createApp([existing]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-null"))).ok).toBe(true);
    expect(created[0].name).toBe("Nya 控制 2");
  });

  it("parents selected layers to one controller without changing their positions", async () => {
    const first = createLayer("shape", { index: 5, position: [400, 300] });
    const second = createLayer("text", { index: 2, position: [800, 500] });
    const before = [first, second].map(worldAnchor);
    const { app, created } = createApp([first, second]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-null"))).ok).toBe(true);
    expect(first.parent).toBe(created[0]);
    expect(second.parent).toBe(created[0]);
    expect([first, second].map(worldAnchor)).toEqual(before);
    expect(created[0].transform["ADBE Position"].value).toEqual([650, 450]);
  });

  it("supports one controller per layer and a 3D controller", async () => {
    const first = createLayer("shape", { index: 2, position: [100, 200] });
    const second = createLayer("text", { index: 1, position: [300, 400] });
    const altSetup = createApp([first, second]);
    const altRun = await loadRunLayerAction(altSetup.app);
    expect(JSON.parse(altRun(encoded("create-null", "alt"))).createdLayers).toBe(2);
    expect(first.parent).not.toBe(second.parent);

    const shiftSetup = createApp([]);
    const shiftRun = await loadRunLayerAction(shiftSetup.app);
    expect(JSON.parse(shiftRun(encoded("create-null", "shift"))).ok).toBe(true);
    expect(shiftSetup.created[0].threeDLayer).toBe(true);
  });

  it("rejects locked selections before creating a partial hierarchy", async () => {
    const { app, created } = createApp([createLayer("shape", { locked: true })]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-null")))).toMatchObject({
      ok: false,
      reason: "invalid-selection"
    });
    expect(created).toHaveLength(0);
  });

  it("rejects already-parented selections instead of replacing their hierarchy", async () => {
    const existingParent = createLayer("null");
    const child = createLayer("shape", { parent: existingParent });
    const { app, created } = createApp([child]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-null")))).toMatchObject({
      ok: false,
      reason: "invalid-selection"
    });
    expect(child.parent).toBe(existingParent);
    expect(created).toHaveLength(0);
  });
});

describe("camera rig host action", () => {
  it.each([0, 35])("uses the motion control across time when the host exposes speed=%s", async nativeSpeed => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig"))).ok).toBe(true);
    const controller = created.find(layer => layer.kind === "null");
    const position = controller.transform["ADBE Position"];
    const effect = controller.controls[0];
    [10, -20, 30].forEach((offset, axis) => effect.property(5 + axis).setValue(offset));
    const base = [970, 520, 30];
    const evaluate = time => {
      const context = {
        value: position.value.slice(), time,
        effect: effectIndex => parameterIndex => {
          if (effectIndex !== 1) throw new Error("invalid-effect-index");
          return effect.property(parameterIndex).value;
        },
        wiggle() { throw new Error("disabled-shake-must-not-run"); }
      };
      // Model a host-owned read-only property, not the full AE expression engine.
      // Plain JS contexts without this binding cannot catch name collisions.
      Object.defineProperty(context, "speed", { value: nativeSpeed, writable: false });
      const result = runInNewContext(position.expression, context, { timeout: 1000 });
      expect(context.speed).toBe(nativeSpeed);
      return result;
    };
    effect.property(14).setValue(190);
    expect(evaluate(2)).toEqual(base);
    effect.property(13).setValue(1);
    expect(evaluate(0)).toEqual(base);
    expect(evaluate(2)).toEqual([970, 520, 410]);
    effect.property(14).setValue(-190);
    expect(evaluate(2)).toEqual([970, 520, -350]);
    effect.property(14).setValue(0);
    expect(evaluate(2)).toEqual(base);
    effect.property(13).setValue(0);
    [5, 6, 7].forEach(index => effect.property(index).setValue(0));
    expect(evaluate(2)).toEqual(position.value);
  });

  it.each([
    ["HD", 1920, 1080, null, [960, 540, 0]],
    ["4K", 3840, 2160, null, [1920, 1080, 0]],
    ["portrait", 1080, 1920, null, [540, 960, 0]],
    ["selected 3D", 1920, 1080, [400.125, 300.5, 20.75], [400.125, 300.5, 20.75]],
    ["distant selection", 1920, 1080, [150000, -120000, 20000], [150000, -120000, 20000]]
  ])("resets position offsets to the stored origin after moving: %s", async (_name, width, height, selected, origin) => {
    const selection = selected ? [createLayer("shape", { position: selected, threeDLayer: true })] : [];
    const { app, comp, created } = createApp(selection);
    comp.width = width;
    comp.height = height;
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig"))).ok).toBe(true);
    const controller = created.find(layer => layer.kind === "null");
    const effect = controller.controls[0];
    const position = controller.transform["ADBE Position"];
    const evaluate = (time = 0) => runInNewContext(position.expression, {
      value: position.value.slice(), time,
      effect: effectIndex => parameterIndex => {
        if (effectIndex !== 1 || !effect.property(parameterIndex)) throw new Error("invalid-effect-index");
        return effect.property(parameterIndex).value;
      },
      wiggle() { throw new Error("disabled-shake-must-not-run"); }
    }, { timeout: 1000 });
    expect(position.value).toEqual(origin);
    expect([5, 6, 7].map(index => effect.property(index).value)).toEqual([0, 0, 0]);
    expect(evaluate()).toEqual(origin);
    [10, -20, 30].forEach((value, axis) => effect.property(5 + axis).setValue(value));
    expect(evaluate()).toEqual([origin[0] + 10, origin[1] - 20, origin[2] + 30]);
    // Model the actual defaults restored by the effect's Reset command.
    [5, 6, 7].forEach(index => effect.property(index).setValue(0));
    expect(evaluate()).toEqual(origin);
    effect.property(13).setValue(1);
    effect.property(14).setValue(5);
    expect(evaluate(2)).toEqual([origin[0], origin[1], origin[2] + 10]);
    effect.property(13).setValue(0);
    effect.property(14).setValue(0);
    expect(evaluate(2)).toEqual(origin);
  });

  it("keeps fractional origin precision outside the zeroed offset controls", async () => {
    const original = createLayer("shape", { position: [400.123456, 300.456789, 20.987654] });
    const { app, created } = createApp([original], { roundCameraPosition: true });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({ ok: true, createdLayers: 2 });
    const controller = created.find(layer => layer.kind === "null");
    expect(controller.transform["ADBE Position"].value).toEqual([400.123456, 300.456789, 20.987654]);
    expect([5, 6, 7].map(index => controller.controls[0].property(index).value)).toEqual([0, 0, 0]);
  });
  it.each([["none", []], ["existing layer", [createLayer("shape", { position: [400, 300, 20] })]]])(
    "applies the camera preset only to its controller with dynamic selection: %s", async (_case, selection) => {
      const { app, created } = createApp(selection, { autoSelectNewLayers: true });
      const run = await loadRunLayerAction(app);
      expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({ ok: true, createdLayers: 2 });
      const controller = created.find(layer => layer.kind === "null");
      const camera = created.find(layer => layer.kind === "camera");
      expect(controller.controls).toHaveLength(1);
      expect(camera.controls).toHaveLength(0);
      expect(selection.every(layer => layer.controls.length === 0)).toBe(true);
    }
  );
  it("recreates a complete controller after deleting the previous camera rig", async () => {
    const { app, created } = createApp([], { autoSelectNewLayers: true });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig"))).ok).toBe(true);
    created.slice().forEach(layer => layer.remove());
    expect(created).toHaveLength(0);

    expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({ ok: true, createdLayers: 2 });
    expect(created.find(layer => layer.kind === "null").controls).toHaveLength(1);
    expect(created.find(layer => layer.kind === "camera").controls).toHaveLength(0);
  });
  it("reports a selected layer position read failure before creating any rig layers", async () => {
    const selected = createLayer("shape");
    Object.defineProperty(selected.transform["ADBE Position"], "value", {
      get() { throw new Error("selected-position-unreadable"); }
    });
    const { app, created } = createApp([selected]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({
      ok: false, detail: expect.stringContaining("selected-position-unreadable")
    });
    expect(created).toHaveLength(0);
    expect(selected.selected).toBe(true);
  });
  it("uses the real camera target-point matchName from AE 25.6", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({ ok: true, createdLayers: 2 });
    const camera = created.find(layer => layer.kind === "camera");
    expect(camera.transform["ADBE Point of Interest"]).toBeUndefined();
    expect(camera.transform["ADBE Anchor Point"].value).toEqual([0, 0, 0]);
    expect(camera.transform["ADBE Anchor Point"].expression).toContain('effect(1)(2)');
    expect(camera.transform["ADBE Anchor Point"].expression).toContain('catch(ignoreMissingTarget)');
  });
  it.each([["zh-CN", "Nya 摄像机", "Nya 摄像机控制"], ["en", "Nya Camera", "Nya Camera Control"]])(
    "localizes %s camera/rig names with an isolated pseudo-effect", async (languageId, cameraName, controllerName) => {
      const { app, created } = createApp();
      const run = await loadRunLayerAction(app);
      expect(JSON.parse(run(encoded("create-camera-rig", "none", languageId)))).toMatchObject({ ok: true, createdLayers: 2 });
      const camera = created.find(layer => layer.kind === "camera");
      const controller = created.find(layer => layer.kind === "null");
      expect(camera.name).toBe(cameraName);
      expect(controller.name).toBe(controllerName);
      expect(camera.parent).toBe(controller);
      expect(controller.guideLayer).toBe(true);
      expect(controller.threeDLayer).toBe(true);
      expect(controller.selected).toBe(true);
      expect(camera.selected).toBe(false);
      expect(camera.transform["ADBE Position"].value).toEqual([0, 0, -1000]);
      expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain("thisLayer.parent");
      expect(controller.controls.map(control => control.name)).toEqual([controllerName]);
    }
  );
  it("creates a 35mm camera parented to a selected 3D guide controller", async () => {
    const { app, created } = createApp();
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-camera-rig")))).toMatchObject({
      ok: true,
      createdLayers: 2
    });
    const camera = created.find((layer) => layer.kind === "camera");
    const controller = created.find((layer) => layer.kind === "null");
    expect(controller).toMatchObject({
      name: "Nya 摄像机控制",
      guideLayer: true,
      threeDLayer: true,
      selected: true
    });
    expect(camera.name).toBe("Nya 摄像机");
    expect(camera.parent).toBe(controller);
    expect(camera.transform["ADBE Position"].value).toEqual([0, 0, -1000]);
    expect(camera.transform["ADBE Anchor Point"].value).toEqual([0, 0, 0]);
    expect(camera.selected).toBe(false);
    expect(controller.controls.map((control) => [control.matchName, control.name])).toEqual([
      ["Pseudo/NYA_Camera_v3_zhCN_r2", "Nya 摄像机控制"]
    ]);
    expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain('effect(1)(17)');
    expect(camera.cameraOptions["ADBE Camera Depth of Field"].expression).toContain('effect(1)(18)');
    expect(camera.transform["ADBE Anchor Point"].expression).toContain('effect(1)(2)');
    expect(controller.movedBefore).toBe(camera);
  });

  it("opens the native camera settings for Ctrl and keeps the controller", async () => {
    const { app, created } = createApp();
    const commands = [];
    app.findMenuCommandId = (name) => name === "Camera Settings..." ? 501 : 0;
    app.executeCommand = (commandId) => commands.push(commandId);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-camera-rig", "ctrl")))).toMatchObject({
      ok: true,
      createdLayers: 2
    });
    expect(created.map((layer) => layer.kind).sort()).toEqual(["camera", "null"]);
    expect(commands).toEqual([501]);
  });

  it("places the camera controller at the selected-layer average", async () => {
    const first = createLayer("shape", { position: [400, 300, 20] });
    const second = createLayer("text", { position: [800, 500, 60] });
    const { app, created } = createApp([first, second]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-camera-rig"))).ok).toBe(true);
    const controller = created.find((layer) => layer.kind === "null");
    expect(controller.transform["ADBE Position"].value).toEqual([
      600,
      400,
      40
    ]);
  });

  it("uses comp-space coordinates for a parented camera target", async () => {
    const parent = createLayer("null");
    const child = createLayer("shape", {
      parent,
      position: [100, 120, 30],
      threeDLayer: true
    });
    child.sourcePointToComp = () => [720, 460, 15];
    const { app, created } = createApp([child]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-camera-rig"))).ok).toBe(true);
    const controller = created.find((layer) => layer.kind === "null");
    expect(controller.transform["ADBE Position"].value).toEqual([
      720,
      460,
      15
    ]);
  });
});

describe("camera pseudo-effect creation contract", () => {
  it("rejects an unreadable/hidden target selector and restores the selection", async () => {
    const original = createLayer("shape", { selected: true });
    const { app, created } = createApp([original], { hiddenTarget: true });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({
      ok: false, detail: expect.stringContaining("camera-target-control-unavailable")
    });
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
  });

  it("tracks the target in the controller's coordinates and follows its world-space distance", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig"))).ok).toBe(true);
    const camera = created.find(layer => layer.kind === "camera");
    const controller = created.find(layer => layer.kind === "null");
    const effect = controller.controls[0];
    let targetWorld = [400, 500, 1200];
    let target = { index: 7, anchorPoint: [10, 20, 0], toWorld: () => targetWorld };
    let missing = false;
    // Translated and rotated parent: +90 degrees around Z, position [100,200,0].
    const ctrl = { effect: () => index => {
      if (index === 2) { if (missing) throw new Error("missing-target"); return target; }
      return effect.property(index).value;
    }, fromWorld: point => [point[1] - 200, 100 - point[0], point[2]] };
    const cameraWorld = [100, 100, 0];
    const evaluate = (expression, value) => runInNewContext(expression, {
      thisLayer: { index: 2, parent: ctrl }, value,
      fromWorld() { throw new Error("camera-space-would-depend-on-its-own-target-point"); },
      toWorld: () => cameraWorld,
      length: (a, b) => Math.hypot(...a.map((n, i) => n - b[i]))
    }, { timeout: 1000 });
    const point = camera.transform["ADBE Anchor Point"].expression;
    const focus = camera.cameraOptions["ADBE Camera Focus Distance"].expression;
    effect.property(21).setValue(1);
    expect(evaluate(point, [0, 0, 0])).toEqual([300, -300, 1200]);
    expect(evaluate(focus, 1000)).toBe(1300);
    targetWorld = [100, 100, 500];
    expect(evaluate(point, [0, 0, 0])).toEqual([-100, 0, 500]);
    expect(evaluate(focus, 1000)).toBe(500);
    effect.property(21).setValue(0);
    effect.property(22).setValue(750);
    expect(evaluate(focus, 1000)).toBe(750);
    effect.property(21).setValue(1);
    for (const cleared of [null, 0]) {
      target = cleared;
      expect(evaluate(point, [0, 0, 0])).toEqual([0, 0, 0]);
      expect(evaluate(focus, 1000)).toBe(750);
    }
    missing = true;
    expect(evaluate(point, [0, 0, 0])).toEqual([0, 0, 0]);
    expect(evaluate(focus, 1000)).toBe(750);
    missing = false;
    target = { index: 2, get anchorPoint() { throw new Error("self-target-cycle"); } };
    expect(evaluate(point, [0, 0, 0])).toEqual([0, 0, 0]);
    expect(evaluate(focus, 1000)).toBe(750);
  });

  it.each(["zh-CN", "zh-TW", "en", "ja"])("binds %s to one checked effect by semantic indexes", async languageId => {
    const first = createLayer("shape", { position: [400, 300, 20] });
    const second = createLayer("text", { position: [800, 500, 60] });
    const { app, created } = createApp([first, second]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig", "none", languageId)))).toMatchObject({
      ok: true, createdLayers: 2
    });
    const camera = created.find(layer => layer.kind === "camera");
    const controller = created.find(layer => layer.kind === "null");
    const effect = controller.controls[0];
    expect(controller.controls).toHaveLength(1);
    expect(effect.property(27).name).toBe("__NYA_CAMERA_V3__");
    expect(controller.transform["ADBE Position"].value).toEqual([600, 400, 40]);
    expect([5, 6, 7].map(index => effect.property(index).value)).toEqual([0, 0, 0]);
    expect(effect.property(2).value).toBe(0);
    expect(effect.property(17).value).toBe(35);
    expect(effect.property(22).value).toBe(1000);
    expect(effect.property(26).value).toBe(2);
    expect(controller.transform["ADBE Position"].expression).toContain("effect(1)(14)");
    expect(controller.transform["ADBE Position"].expression).toContain("time*nyaMotionSpeed");
    expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain(".effect(1)(17)");
    expect(camera.cameraOptions["ADBE Camera Focus Distance"].expression).toContain(".effect(1)(2)");
    expect(camera.cameraOptions["ADBE Camera Depth of Field"].expression).toContain(".effect(1)(18)");
    expect(camera.transform["ADBE Anchor Point"].expression).toContain(".effect(1)(2)");
    expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain("thisLayer.parent");
    expect(camera.parent).toBe(controller);
    expect(first.selected && second.selected).toBe(false);
    expect([app.undoBegins, app.undoEnds]).toEqual([1, 1]);
  });

  it.each([false, true])("creates a Korean rig with explicit English controls, selected=%s", async selected => {
    const original = createLayer("shape", { selected: true });
    const { app, created } = createApp(selected ? [original] : [], { autoSelectNewLayers: true });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig", "none", "ko")))).toMatchObject({
      ok: true, createdLayers: 2, notice: "camera-controls-english"
    });
    const camera = created.find(layer => layer.kind === "camera");
    const controller = created.find(layer => layer.kind === "null");
    expect(camera.name).toBe("Nya 카메라");
    expect(controller.name).toBe("Nya 카메라 컨트롤");
    expect(camera.parent).toBe(controller);
    expect(controller.controls).toHaveLength(1);
    const effect = controller.controls[0];
    expect(effect).toMatchObject({ name: "Nya 카메라 컨트롤", matchName: "Pseudo/NYA_Camera_v3_en_r2" });
    expect(effect.property(27).name).toBe("__NYA_CAMERA_V3__");
    expect(effect.property(2).value).toBe(0);
    effect.property(13).setValue(1);
    effect.property(14).setValue(190);
    const position = controller.transform["ADBE Position"];
    const output = runInNewContext(position.expression, {
      value: position.value.slice(), time: 2,
      effect: () => index => effect.property(index).value
    });
    expect(output).toEqual([position.value[0], position.value[1], position.value[2] + 380]);
  });

  it("still refuses a missing Korean mapping before creating any layer", async () => {
    const original = createLayer("shape", { selected: true });
    const { app, created } = createApp([original]);
    const catalog = JSON.parse(await readFile("public/host/pseudo-effects/catalog.json", "utf8"));
    delete catalog.templates["camera.rig/v3/ko"];
    const run = await loadRunLayerAction(app, { catalogOverride: JSON.stringify(catalog) });
    expect(JSON.parse(run(encoded("create-camera-rig", "none", "ko")))).toMatchObject({
      ok: false, detail: expect.stringContaining("pseudo-template-locale-unavailable: ko")
    });
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
  });

  it("keeps Korean and English camera controls independent in the same composition", async () => {
    const { app, created } = createApp([], { autoSelectNewLayers: true });
    const run = await loadRunLayerAction(app);
    for (const locale of ["ko", "en"]) {
      expect(JSON.parse(run(encoded("create-camera-rig", "none", locale))).ok).toBe(true);
    }
    const controllers = created.filter(layer => layer.kind === "null");
    expect(controllers.map(layer => layer.controls[0].name).sort()).toEqual(["Nya Camera Control", "Nya 카메라 컨트롤"]);
    const korean = controllers.find(layer => layer.name === "Nya 카메라 컨트롤").controls[0];
    const english = controllers.find(layer => layer.name === "Nya Camera Control").controls[0];
    korean.property(13).setValue(1);
    korean.property(14).setValue(190);
    expect(english.property(13).value).toBe(0);
    expect(english.property(14).value).toBe(0);
    expect(controllers[0].transform["ADBE Position"].expression).toBe(controllers[1].transform["ADBE Position"].expression);
    expect(created.filter(layer => layer.kind === "camera").map(layer => layer.parent)).toEqual(controllers);
  });

  it.each(["controlLocale", "sourceTemplateId"])("rejects an undeclared Korean compatibility %s before creation", async field => {
    const catalog = JSON.parse(await readFile("public/host/pseudo-effects/catalog.json", "utf8"));
    catalog.templates["camera.rig/v3/ko"] = {
      ...catalog.templates["camera.rig/v3/en"], locale: "ko", displayName: "Nya 카메라 컨트롤",
      controlLocale: "en", sourceTemplateId: "camera.rig/v3/en", [field]: "unexpected"
    };
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app, { catalogOverride: JSON.stringify(catalog) });
    expect(JSON.parse(run(encoded("create-camera-rig", "none", "ko")))).toMatchObject({
      ok: false, detail: expect.stringContaining("pseudo-template-invalid")
    });
    expect(created).toHaveLength(0);
  });

  it("rejects a shifted catalog index before creating a camera", async () => {
    const catalog = JSON.parse(await readFile("public/host/pseudo-effects/catalog.json", "utf8"));
    catalog.templates["camera.rig/v3/zh-CN"].parameters["position.x"] = 6;
    const original = createLayer("shape", { selected: true });
    const { app, created } = createApp([original]);
    const run = await loadRunLayerAction(app, { catalogOverride: JSON.stringify(catalog) });
    expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({
      ok: false, detail: expect.stringContaining("pseudo-template-invalid")
    });
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
  });

  it("uses its own parent when another controller already has the same display name", async () => {
    const existing = createLayer("null", { name: "Nya 摄像机控制", selected: true });
    const { app, created } = createApp([existing]);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig"))).ok).toBe(true);
    const controller = created.find(layer => layer.kind === "null");
    const camera = created.find(layer => layer.kind === "camera");
    expect(controller.name).toBe("Nya 摄像机控制 2");
    expect(camera.parent).toBe(controller);
    expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain("thisLayer.parent.effect");
    expect(camera.cameraOptions["ADBE Camera Zoom"].expression).not.toContain("thisComp.layer(");
    expect(existing.parent).toBeNull();
  });

  it.each([{ missingPreset: true }, { badSignature: true }, { badLayerType: true }, { throwOnApply: true }])(
    "leaves the original selection and no rig after template failure %o", async presetOptions => {
      const original = createLayer("shape", { selected: true });
      const { app, created } = createApp([original], presetOptions);
      const run = await loadRunLayerAction(app, presetOptions);
      expect(JSON.parse(run(encoded("create-camera-rig"))).ok).toBe(false);
      expect(created).toHaveLength(0);
      expect(original.selected).toBe(true);
      expect([app.undoBegins, app.undoEnds]).toEqual([1, 1]);
    }
  );

  it("removes both layers if an expression fails after the preset is applied", async () => {
    const original = createLayer("shape", { selected: true });
    const { app, created, comp } = createApp([original]);
    const addCamera = comp.layers.addCamera;
    comp.layers.addCamera = (...args) => {
      const camera = addCamera(...args);
      camera.cameraOptions["ADBE Camera Zoom"].expressionError = "invalid expression";
      return camera;
    };
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig"))).ok).toBe(false);
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
  });

  it("does not leave a camera when Ctrl settings cannot open", async () => {
    const original = createLayer("shape", { selected: true });
    const { app, created } = createApp([original]);
    app.findMenuCommandId = name => name === "Camera Settings..." ? 501 : 0;
    app.executeCommand = () => { throw new Error("menu-failure"); };
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig", "ctrl"))).ok).toBe(false);
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
  });

  it("reports an incomplete rollback if a new Null cannot be removed", async () => {
    const { app, comp, created } = createApp();
    const addNull = comp.layers.addNull;
    comp.layers.addNull = () => {
      const layer = addNull();
      layer.transform["ADBE Anchor Point"].setValue = () => { throw new Error("init-failed"); };
      layer.remove = () => { throw new Error("remove-failed"); };
      return layer;
    };
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("create-camera-rig")))).toMatchObject({
      ok: false, detail: expect.stringContaining("camera-rollback-failed")
    });
    expect(created.map(layer => layer.kind)).toEqual(["null"]);
  });
});
