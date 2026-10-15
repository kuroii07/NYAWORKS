import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

class Comp {}
class Camera {}

async function inspect({ active = true, writeAllowed = true } = {}) {
  let evaluated = false;
  let output = "";
  const alerts = [];
  const mutate = vi.fn(() => { throw new Error("unexpected-project-mutation"); });
  const position = {
    expression: "[effect(1)(5),effect(1)(6),effect(1)(7)]",
    get expressionEnabled() { return !evaluated; },
    get expressionError() { return evaluated ? "effect index out of range" : ""; },
    valueAtTime(_time, preExpression) {
      if (!preExpression) evaluated = true;
      return [960, 540, 0];
    },
    setValue: mutate
  };
  const effect = {
    matchName: "Pseudo/NYA_Camera_v1_zhCN", numProperties: 29, enabled: true,
    property: index => ({ valueAtTime: () => index === 5 ? 16460 : 0, setValue: mutate })
  };
  const controller = {
    index: 1, selected: true, threeDLayer: true, enabled: true,
    property: name => name === "ADBE Effect Parade"
      ? { numProperties: 1, property: () => effect }
      : { property: name => name === "ADBE Position" ? position : null },
    remove: mutate, applyPreset: mutate
  };
  const camera = Object.assign(new Camera(), {
    index: 2, selected: false, parent: null, enabled: true, inPoint: 0, outPoint: 10,
    property: () => null, remove: mutate
  });
  const shape = { index: 3, selected: false, threeDLayer: false, enabled: true, property: () => null };
  const comp = Object.assign(new Comp(), {
    numLayers: 3, time: 0, activeCamera: camera,
    layer: index => [controller, camera, shape][index - 1],
    layers: { addNull: mutate, addCamera: mutate }, remove: mutate
  });
  const app = { version: "25.6", project: { activeItem: active ? comp : null, save: mutate }, executeCommand: mutate };
  function File(path) {
    this.fsName = path;
    this.parent = { exists: true, create: vi.fn() };
    this.open = () => writeAllowed;
    this.write = text => { output = text; };
    this.close = vi.fn();
  }
  const source = await readFile("scripts/ae-tests/read-camera-rig-state.jsx", "utf8");
  runInNewContext(source, {
    app, CompItem: Comp, CameraLayer: Camera, File, Folder: { userData: { fsName: "userdata" } },
    $: { global: { NYAWORKS: { getHostRevision: () => "test-revision" } } },
    alert: text => alerts.push(text), Array
  }, { timeout: 1000 });
  expect(mutate).not.toHaveBeenCalled();
  expect(controller.selected).toBe(true);
  expect(camera.selected).toBe(false);
  expect(camera.parent).toBe(null);
  return { output, alerts };
}

describe("read-only camera state inspection", () => {
  it("captures expression failures that appear only after evaluating the position", async () => {
    const { output } = await inspect();
    expect(output).toContain("control5 evaluated=16460");
    expect(output).toContain("controller1.position evaluated=[960,540,0]");
    expect(output).toContain("controller1.position enabledAfter=false expressionErrorAfter=effect index out of range");
    expect(output).not.toContain("inspectionError=");
  });

  it("records an active camera even when it is not parented to the inspected controller", async () => {
    const { output } = await inspect();
    expect(output).toContain("cameraIndex=2 parentIndex=none active=true");
    expect(output).toContain("sceneLayerIndex=3 threeD=false");
  });

  it("writes an explicit no-comp result without changing the project", async () => {
    const { output } = await inspect({ active: false });
    expect(output).toContain("activeComp=none");
  });

  it("shows a write failure instead of silently producing no report", async () => {
    const { output, alerts } = await inspect({ writeAllowed: false });
    expect(output).toBe("");
    expect(alerts.join(" ")).toContain("camera-rig-live-state.txt");
    expect(alerts).toHaveLength(1);
  });
});
