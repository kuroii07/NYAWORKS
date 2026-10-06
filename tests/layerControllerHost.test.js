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
    "ADBE Rotate Z": prop(0)
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
    selected: false,
    controls,
    transform,
    cameraOptions,
    get parent() { return parent; },
    set parent(value) { parent = value; },
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
    get numLayers() { return created.length + selection.length; },
    layer(index) { return [...created, ...selection][index - 1]; }
  });
  comp.layers = {
    addNull() {
      const layer = createLayer("null", { name: "Null" });
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
      beginUndoGroup() {},
      endUndoGroup() {}
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

function encoded(action, modifier = "none") {
  return encodeURIComponent(JSON.stringify({ action, modifier }));
}

describe("null controller host action", () => {
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
    const before = [first, second].map((layer) => layer.transform["ADBE Position"].value.slice());
    const { app, created } = createApp([first, second]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-null"))).ok).toBe(true);
    expect(first.parent).toBe(created[0]);
    expect(second.parent).toBe(created[0]);
    expect([first, second].map((layer) => layer.transform["ADBE Position"].value)).toEqual(before);
    expect(created[0].transform["ADBE Position"].value).toEqual([600, 400]);
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
