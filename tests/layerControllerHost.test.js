import { readFile } from "node:fs/promises";
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
    "ADBE Point of Interest": prop([0, 0, 0]),
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

function createApp(selection = []) {
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
  comp.layers = {
    addNull() {
      const layer = createLayer("null", { name: "Null" });
      layer.remove = () => created.splice(created.indexOf(layer), 1);
      created.unshift(layer);
      return layer;
    },
    addCamera(name, point) {
      const layer = createLayer("camera", { name, position: [point[0], point[1], -1000] });
      layer.point = point;
      created.unshift(layer);
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

function encoded(action, modifier = "none", languageId) {
  return encodeURIComponent(JSON.stringify({ action, modifier, languageId }));
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
  it.each([["zh-CN", "Nya 摄像机", "Nya 摄像机控制"], ["en", "Nya Camera", "Nya Camera Control"]])(
    "localizes %s camera/rig names while retaining control parameters and instance references", async (languageId, cameraName, controllerName) => {
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
      expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain(`thisComp.layer("${controllerName}")`);
      expect(controller.controls.map(control => control.name)).toContain("Nya 镜头焦距");
      expect(controller.controls).toHaveLength(15);
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
    expect(camera.transform["ADBE Point of Interest"].value).toEqual([0, 0, 0]);
    expect(camera.selected).toBe(false);
    expect(controller.controls.map((control) => [control.matchName, control.name])).toEqual([
      ["ADBE Layer Control", "Nya 目标图层"],
      ["ADBE Slider Control", "Nya 相机位置 X"],
      ["ADBE Slider Control", "Nya 相机位置 Y"],
      ["ADBE Slider Control", "Nya 相机位置 Z"],
      ["ADBE Angle Control", "Nya 相机旋转 X"],
      ["ADBE Angle Control", "Nya 相机旋转 Y"],
      ["ADBE Angle Control", "Nya 相机旋转 Z"],
      ["ADBE Checkbox Control", "Nya 自动移动"],
      ["ADBE Slider Control", "Nya 移动速度"],
      ["ADBE Slider Control", "Nya 镜头焦距"],
      ["ADBE Checkbox Control", "Nya 镜头景深"],
      ["ADBE Checkbox Control", "Nya 焦点自动"],
      ["ADBE Slider Control", "Nya 焦点距离"],
      ["ADBE Slider Control", "Nya 抖动强度"],
      ["ADBE Slider Control", "Nya 抖动频率"]
    ]);
    expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain("Nya 镜头焦距");
    expect(camera.cameraOptions["ADBE Camera Depth of Field"].expression).toContain("Nya 镜头景深");
    expect(camera.transform["ADBE Point of Interest"].expression).toContain("Nya 目标图层");
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
    expect(controller.controls.filter((control) => control.name.indexOf("Nya 相机位置") === 0).map((control) => control.value.value)).toEqual([
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
    expect(controller.controls.filter((control) => control.name.indexOf("Nya 相机位置") === 0).map((control) => control.value.value)).toEqual([
      720,
      460,
      15
    ]);
  });
});
