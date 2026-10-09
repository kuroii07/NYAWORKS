import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadRunLayerAction(app) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const catalog = await readFile("public/host/pseudo-effects/catalog.json", "utf8");
  function TestFile(path) {
    this.fsName = path;
    this.exists = !app.missingPreset &&
      /^C:\/CEP\/NYAWORKS\/host\/pseudo-effects\/(catalog\.json|rounded-rectangle-zh-CN\.ffx)$/.test(path);
    this.error = app.catalogUnreadable ? "Permission denied" : "";
    this.open = () => this.exists && !app.catalogUnreadable;
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
  )(app, TestComp, {}, JSON, decodeURIComponent, TestFile, {
    parent: { fsName: "C:/Program Files/Common Files/Adobe/Startup Scripts CC/Adobe After Effects" }
  });
}

class TestComp {}

function valueProperty(initial = null, backingState = null) {
  const state = backingState || {
    value: initial,
    expression: "",
    expressionEnabled: false,
    expressionError: ""
  };
  let valid = true;
  const property = {
    get valid() { return valid; },
    invalidate() { valid = false; },
    setValue(value) {
      if (!valid) throw new ReferenceError("Object is invalid");
      state.value = value;
    }
  };
  for (const key of ["value", "expression", "expressionEnabled", "expressionError"]) {
    Object.defineProperty(property, key, {
      get() {
        if (!valid) throw new ReferenceError("Object is invalid");
        return state[key];
      },
      set(value) {
        if (!valid) throw new ReferenceError("Object is invalid");
        state[key] = value;
      }
    });
  }
  return property;
}

function createShapeLayer({ invalidateVectorReferences = false } = {}) {
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
      if (invalidateVectorReferences) {
        for (const existing of vectors) {
          for (const property of Object.values(existing.values)) property.invalidate();
        }
      }
      const states = {};
      const vector = {
        matchName,
        name: "",
        propertyIndex: vectors.length + 1,
        values: {},
        property(name) {
          if (!states[name]) {
            states[name] = {
              value: null,
              expression: "",
              expressionEnabled: false,
              expressionError: ""
            };
          }
          if (!this.values[name] || !this.values[name].valid) {
            this.values[name] = valueProperty(null, states[name]);
          }
          return this.values[name];
        }
      };
      vectors.push(vector);
      return vector;
    },
    property(index) { return vectors[index - 1] || null; }
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
      const values = [
        500, 500, 50, 0, null, 50, 50, 50, 50, null,
        null, 1, [1, 1, 1, 1], 0, [0, 0, 0, 1], 5, null
      ];
      controls.push({
        matchName: "Pseudo/NYA_RRect_v7_zhCN",
        name: "Nya 圆角矩形",
        numProperties: 18,
        property(index) {
          const names = ["宽度", "高度", "圆角值", "分离圆角", "分离参数",
            "左上角", "右上角", "右下角", "左下角", "", "样式",
            "启用填充", "填充颜色", "启用描边", "描边颜色", "描边宽度", "__NYA_RRECT_V7__"];
          return index <= 17 ? {
            name: names[index - 1],
            matchName: `Pseudo/NYA_RRect_v7_zhCN-${String(index).padStart(4, "0")}`,
            propertyValueType: [5, 10, 11, 17].includes(index) ? 6412 : 6417,
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

function createApp(options = {}) {
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
        const layer = createShapeLayer(options);
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
  return encodeURIComponent(JSON.stringify({
    action: "create-shape",
    modifier,
    extensionRoot: "C:/CEP/NYAWORKS"
  }));
}

function evaluateRoundedPath(layer, controls) {
  const path = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Shape - Group");
  const expression = path.values["ADBE Vector Shape"].expression;
  return Function(
    "effect",
    "createPath",
    `${expression.replace("createPath(points,ins,outs,true);", "return createPath(points,ins,outs,true);")}`
  )(
    () => (index) => controls[index],
    (points, ins, outs, closed) => ({ points, ins, outs, closed })
  );
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
    expect(layer.controls.map((control) => control.matchName)).toEqual(["Pseudo/NYA_RRect_v7_zhCN"]);
    const path = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Shape - Group");
    expect(path.values["ADBE Vector Shape"].expressionEnabled).toBe(true);
    expect(path.values["ADBE Vector Shape"].expression).toContain('effect("Nya 圆角矩形")(6)');
    const evaluated = evaluateRoundedPath(layer, [null, 500, 500, 50, 0, null, 50, 50, 50, 50]);
    expect(evaluated.ins[0]).toEqual([-0.5522847498 * 125, 0]);
    expect(evaluated.outs[7]).toEqual([0, -0.5522847498 * 125]);
    expect(evaluated.outs[1]).toEqual([0.5522847498 * 125, 0]);
    expect(evaluated.ins[2]).toEqual([0, -0.5522847498 * 125]);
    expect(evaluated.closed).toBe(true);
  });

  it("creates real fill and stroke operators controlled by the v7 style parameters", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);

    expect(JSON.parse(run(encoded("none"))).ok).toBe(true);
    const layer = created[0];
    const fill = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Graphic - Fill");
    const stroke = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Graphic - Stroke");

    expect(fill).toBeTruthy();
    expect(stroke).toBeTruthy();
    expect(fill.values["ADBE Vector Fill Opacity"].expression).toContain('(12)>0?100:0');
    expect(fill.values["ADBE Vector Fill Color"].expression).toContain('(13)');
    expect(stroke.values["ADBE Vector Stroke Opacity"].expression).toContain('(14)>0?100:0');
    expect(stroke.values["ADBE Vector Stroke Color"].expression).toContain('(15)');
    expect(stroke.values["ADBE Vector Stroke Width"].expression).toContain('(16)');
  });

  it("reacquires style properties after AE invalidates indexed-group references", async () => {
    const { app, created } = createApp({ invalidateVectorReferences: true });
    const run = await loadRunLayerAction(app);

    expect(JSON.parse(run(encoded("none")))).toMatchObject({ ok: true });
    expect(created).toHaveLength(1);
    const fill = created[0].vectors.find((vector) => vector.matchName === "ADBE Vector Graphic - Fill");
    expect(fill.property("ADBE Vector Fill Opacity").expression).toContain('(12)>0?100:0');
  });

  it("maps master 0–100 to square–circle and keeps the default shape unchanged on separation", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("none"))).ok).toBe(true);
    const layer = created[0];
    const controls = [null, 500, 500, 0, 0, null, 50, 50, 50, 50];
    const square = evaluateRoundedPath(layer, controls);
    expect(square.points[0]).toEqual([-250, -250]);
    expect(square.ins[0][0]).toBeCloseTo(0);
    expect(square.ins[0][1]).toBeCloseTo(0);
    controls[3] = 100;
    const circle = evaluateRoundedPath(layer, controls);
    expect(circle.points[0]).toEqual([0, -250]);
    expect(circle.points[2]).toEqual([250, 0]);
    controls[3] = 50;
    const together = evaluateRoundedPath(layer, controls);
    controls[4] = 1;
    expect(evaluateRoundedPath(layer, controls)).toEqual(together);
    controls[3] = 0;
    expect(evaluateRoundedPath(layer, controls)).toEqual(together);
    controls[6] = 0;
    const independent = evaluateRoundedPath(layer, controls);
    expect(independent.points[0]).toEqual([-250, -250]);
    expect(independent.points[2]).toEqual([250, -125]);
  });

  it("refuses a missing pseudo template before creating a layer", async () => {
    const { app, created } = createApp();
    app.missingPreset = true;
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("none")))).toMatchObject({
      ok: false,
      detail: expect.stringContaining("pseudo-catalog-missing: C:/CEP/NYAWORKS/host/pseudo-effects/catalog.json")
    });
    expect(created).toHaveLength(0);
  });

  it("distinguishes a catalog read failure from a missing file without creating a layer", async () => {
    const { app, created } = createApp();
    app.catalogUnreadable = true;
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("none")))).toMatchObject({
      ok: false,
      detail: expect.stringContaining("pseudo-catalog-unreadable: C:/CEP/NYAWORKS/host/pseudo-effects/catalog.json (Permission denied)")
    });
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
