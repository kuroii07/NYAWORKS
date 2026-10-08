import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadRunLayerAction(app) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const catalog = await readFile("public/host/pseudo-effects/catalog.json", "utf8");
  function TestFile(path) {
    this.fsName = path;
    this.exists = !app.missingPreset && /pseudo-effects[\\/]/.test(path);
    this.open = () => this.exists;
    this.read = () => catalog;
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
    "hostScriptFile",
    `${source.slice(start, end)}
return runLayerAction;`
  )(app, TestComp, {}, JSON, decodeURIComponent, TestFile, { parent: { fsName: "host" } });
}

class TestComp {}

function valueProperty(initial = null) {
  return {
    value: initial,
    expression: "",
    expressionEnabled: false,
    setValue(value) { this.value = value; }
  };
}

function createShapeLayer() {
  const controls = [];
  const vectors = [];
  const anchor = valueProperty([0, 0]);
  const position = valueProperty([0, 0]);
  const effectParade = {
    get numProperties() { return controls.length; },
    property(index) { return controls[index - 1]; },
    addProperty(matchName) {
      const control = {
        matchName,
        name: "",
        value: valueProperty(),
        property() { return this.value; }
      };
      controls.push(control);
      return control;
    }
  };
  const vectorContents = {
    addProperty(matchName) {
      const vector = {
        matchName,
        name: "",
        values: {},
        property(name) {
          if (!this.values[name]) this.values[name] = valueProperty();
          return this.values[name];
        }
      };
      vectors.push(vector);
      return vector;
    }
  };
  const group = {
    property(name) {
      return name === "ADBE Vectors Group" ? vectorContents : null;
    }
  };
  const root = {
    addProperty(matchName) {
      if (matchName === "ADBE Vector Group") return group;
      throw new Error(`Unexpected root property ${matchName}`);
    }
  };
  return {
    controls,
    vectors,
    anchor,
    position,
    selected: false,
    applyPreset(file) {
      if (!file.exists) throw new Error("missing-template");
      const values = [500, 500, 50, 0, null, 50, 50, 50, 50, null];
      controls.push({
        matchName: "Pseudo/NYA_RRect_v1_zhCN",
        name: "Nya 圆角矩形",
        numProperties: 11,
        property(index) {
          const names = ["宽度", "高度", "圆角值", "分离圆角", "分离参数",
            "左上角", "右上角", "右下角", "左下角", "__NYA_RRECT_V1__"];
          return index <= 10 ? {
            name: names[index - 1],
            matchName: `Pseudo/NYA_RRect_v1_zhCN-${String(index).padStart(4, "0")}`,
            propertyValueType: index === 5 || index === 10 ? 6412 : 6417,
            value: values[index - 1]
          } : null;
        }
      });
    },
    moveToBeginning() {},
    property(name) {
      if (name === "ADBE Effect Parade") return effectParade;
      if (name === "ADBE Root Vectors Group") return root;
      if (name === "ADBE Transform Group") {
        return { property: (child) => child === "ADBE Anchor Point" ? anchor : position };
      }
      return null;
    }
  };
}

function createApp() {
  const created = [];
  const comp = Object.assign(new TestComp(), {
    width: 1920,
    height: 1080,
    pixelAspect: 1,
    displayStartTime: 0,
    duration: 10,
    selectedLayers: [],
    get numLayers() { return created.length; },
    layer(index) { return created[index - 1]; },
    layers: {
      addShape() {
        const layer = createShapeLayer();
        layer.remove = () => {
          const index = created.indexOf(layer);
          if (index !== -1) created.splice(index, 1);
        };
        created.unshift(layer);
        return layer;
      }
    }
  });
  return {
    app: {
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    },
    created
  };
}

function encoded(modifier) {
  return encodeURIComponent(JSON.stringify({ action: "create-shape", modifier }));
}

describe("shape layer host action", () => {
  it("creates a centered controlled rounded rectangle with independent corners", async () => {
    const { app, created } = createApp();
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded("none"))).ok).toBe(true);
    const layer = created[0];
    expect(layer.anchor.value).toEqual([0, 0]);
    expect(layer.position.value).toEqual([960, 540]);
    expect(layer.name).toBe("Nya 圆角矩形");
    expect(layer.controls.map((control) => control.matchName)).toEqual(["Pseudo/NYA_RRect_v1_zhCN"]);
    const path = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Shape - Group");
    expect(path.values["ADBE Vector Shape"].expressionEnabled).toBe(true);
    expect(path.values["ADBE Vector Shape"].expression).toContain('effect("Nya 圆角矩形")(6)');
    const expression = path.values["ADBE Vector Shape"].expression;
    const evaluated = Function(
      "effect",
      "createPath",
      `${expression.replace("createPath(points,ins,outs,true);", "return createPath(points,ins,outs,true);")}`
    )(
      () => (index) => [null, 500, 500, 50, 0, null, 50, 50, 50, 50][index],
      (points, ins, outs, closed) => ({ points, ins, outs, closed })
    );
    expect(evaluated.ins[0]).toEqual([-0.5522847498 * 50, 0]);
    expect(evaluated.outs[7]).toEqual([0, -0.5522847498 * 50]);
    expect(evaluated.outs[1]).toEqual([0.5522847498 * 50, 0]);
    expect(evaluated.ins[2]).toEqual([0, -0.5522847498 * 50]);
    expect(evaluated.closed).toBe(true);
  });

  it("refuses a missing pseudo template before creating a layer", async () => {
    const { app, created } = createApp();
    app.missingPreset = true;
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("none")))).toMatchObject({ ok: false });
    expect(created).toHaveLength(0);
  });

  it("removes only the new layer and restores the user's selection when preset binding fails", async () => {
    const { app, created } = createApp();
    const comp = app.project.activeItem;
    const original = { selected: true, inPoint: 1, outPoint: 5, index: 1 };
    comp.selectedLayers = [original];
    const addShape = comp.layers.addShape;
    comp.layers.addShape = () => {
      const layer = addShape();
      original.selected = false;
      comp.selectedLayers = [layer];
      layer.applyPreset = () => { throw new Error("bad-ffx"); };
      return layer;
    };
    const run = await loadRunLayerAction(app);
    const result = JSON.parse(run(encoded("none")));
    expect(result).toMatchObject({ ok: false, reason: "host-error" });
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
  });

  it.each([
    ["alt", "Nya 圆", "ADBE Vector Shape - Ellipse", ["Nya 半径"]],
    ["ctrl", "Nya 三角形", "ADBE Vector Shape - Star", ["Nya 半径", "Nya 旋转", "Nya 圆角"]],
    ["shift", "Nya 星形", "ADBE Vector Shape - Star", ["Nya 角数", "Nya 外半径", "Nya 内半径", "Nya 旋转", "Nya 外圆角", "Nya 内圆角"]]
  ])("creates the %s modifier variant with only useful controls", async (modifier, layerName, matchName, controlNames) => {
    const { app, created } = createApp();
    const runLayerAction = await loadRunLayerAction(app);

    expect(JSON.parse(runLayerAction(encoded(modifier))).ok).toBe(true);
    expect(created[0].name).toBe(layerName);
    expect(created[0].vectors.some((vector) => vector.matchName === matchName)).toBe(true);
    expect(created[0].controls.map((control) => control.name)).toEqual(controlNames);
  });
});
