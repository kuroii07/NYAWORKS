import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

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
    expect(layer.controls.map((control) => [control.matchName, control.name, control.value.value])).toEqual([
      ["ADBE Slider Control", "Nya 宽度", 500],
      ["ADBE Slider Control", "Nya 高度", 500],
      ["ADBE Slider Control", "Nya 圆角值", 50],
      ["ADBE Checkbox Control", "Nya 分离圆角", 0],
      ["ADBE Slider Control", "Nya 左上圆角", 50],
      ["ADBE Slider Control", "Nya 右上圆角", 50],
      ["ADBE Slider Control", "Nya 右下圆角", 50],
      ["ADBE Slider Control", "Nya 左下圆角", 50]
    ]);
    const path = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Shape - Group");
    expect(path.values["ADBE Vector Shape"].expressionEnabled).toBe(true);
    expect(path.values["ADBE Vector Shape"].expression).toContain('effect("Nya 左上圆角")(1)');
    const expression = path.values["ADBE Vector Shape"].expression;
    const evaluated = Function(
      "effect",
      "createPath",
      `${expression.replace("createPath(points,ins,outs,true);", "return createPath(points,ins,outs,true);")}`
    )(
      (name) => () => ({
        "Nya 宽度": 500,
        "Nya 高度": 500,
        "Nya 圆角值": 50,
        "Nya 分离圆角": 0,
        "Nya 左上圆角": 50,
        "Nya 右上圆角": 50,
        "Nya 右下圆角": 50,
        "Nya 左下圆角": 50
      })[name],
      (points, ins, outs, closed) => ({ points, ins, outs, closed })
    );
    expect(evaluated.ins[0]).toEqual([-0.5522847498 * 50, 0]);
    expect(evaluated.outs[7]).toEqual([0, -0.5522847498 * 50]);
    expect(evaluated.outs[1]).toEqual([0.5522847498 * 50, 0]);
    expect(evaluated.ins[2]).toEqual([0, -0.5522847498 * 50]);
    expect(evaluated.closed).toBe(true);
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
