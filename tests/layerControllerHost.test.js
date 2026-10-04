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
      name: "Nya Controller",
      guideLayer: true,
      threeDLayer: false,
      selected: true
    });
    expect(created[0].transform["ADBE Anchor Point"].value).toEqual([50, 50]);
    expect(created[0].transform["ADBE Position"].value).toEqual([960, 540]);
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
      name: "Nya Camera Controller",
      guideLayer: true,
      threeDLayer: true,
      selected: true
    });
    expect(camera.name).toBe("Nya Camera");
    expect(camera.parent).toBe(controller);
    expect(camera.selected).toBe(false);
    expect(controller.controls.map((control) => [control.matchName, control.name])).toEqual([
      ["ADBE Slider Control", "Nya Position X"],
      ["ADBE Slider Control", "Nya Position Y"],
      ["ADBE Slider Control", "Nya Position Z"],
      ["ADBE Angle Control", "Nya Rotation X"],
      ["ADBE Angle Control", "Nya Rotation Y"],
      ["ADBE Angle Control", "Nya Rotation Z"],
      ["ADBE Slider Control", "Nya Focal Length"],
      ["ADBE Checkbox Control", "Nya Depth of Field"],
      ["ADBE Checkbox Control", "Nya Focus to Point"]
    ]);
    expect(camera.cameraOptions["ADBE Camera Zoom"].expression).toContain("Nya Focal Length");
    expect(camera.cameraOptions["ADBE Camera Depth of Field"].expression).toContain("Nya Depth of Field");
  });

  it("creates a camera without a controller for Alt", async () => {
    const { app, created } = createApp();
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-camera-rig", "alt")))).toMatchObject({
      ok: true,
      createdLayers: 1
    });
    expect(created.map((layer) => layer.kind)).toEqual(["camera"]);
    expect(created[0].parent).toBe(null);
  });

  it("places the camera controller at the selected-layer average", async () => {
    const first = createLayer("shape", { position: [400, 300, 20] });
    const second = createLayer("text", { position: [800, 500, 60] });
    const { app, created } = createApp([first, second]);
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("create-camera-rig"))).ok).toBe(true);
    const controller = created.find((layer) => layer.kind === "null");
    expect(controller.controls.slice(0, 3).map((control) => control.value.value)).toEqual([
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
    expect(controller.controls.slice(0, 3).map((control) => control.value.value)).toEqual([
      720,
      460,
      15
    ]);
  });
});
