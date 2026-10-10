import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import ts from "typescript";

async function loadLayerHost(app) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const catalog = await readFile("public/host/pseudo-effects/catalog.json", "utf8");
  function TestFile(path) {
    this.fsName = path;
    this.exists = !app.missingPreset &&
      !(app.missingCirclePreset && path.endsWith("/circle-zh-CN.ffx")) &&
      !(app.missingTrianglePreset && path.endsWith("/triangle-zh-CN.ffx")) &&
      !(app.missingStarPreset && path.endsWith("/star-zh-CN.ffx")) &&
      /^C:\/CEP\/NYAWORKS\/host\/pseudo-effects\/(catalog\.json|rounded-rectangle-zh-CN\.ffx|circle-zh-CN\.ffx|triangle-zh-CN\.ffx|star-zh-CN\.ffx)$/.test(path);
    this.error = app.catalogUnreadable ? "Permission denied" : "";
    this.open = () => this.exists && !app.catalogUnreadable;
    this.read = () => app.catalogOverride || catalog;
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
return {
  runLayerAction: runLayerAction,
  getLastShapePseudoTrace: getLastShapePseudoTrace,
  createRoundedRectangleShape: createRoundedRectangleShape,
  createEllipseShape: createEllipseShape,
  createPolygonShape: createPolygonShape,
  preflightPseudoEffectTemplate: typeof preflightPseudoEffectTemplate === "function" ? preflightPseudoEffectTemplate : null,
  applyPseudoEffectTemplate: typeof applyPseudoEffectTemplate === "function" ? applyPseudoEffectTemplate : null
};`
  )(app, TestComp, {}, JSON, decodeURIComponent, TestFile, {
    parent: { fsName: "C:/Program Files/Common Files/Adobe/Startup Scripts CC/Adobe After Effects" }
  });
}

async function loadRunLayerAction(app) {
  return (await loadLayerHost(app)).runLayerAction;
}

class TestComp {}

// Deliberately independent of the production catalog and schema: a shifted
// group or parameter must fail the Host contract instead of moving the fixture.
const polygonPresets = {
  "triangle-zh-CN.ffx": {
    matchName: "Pseudo/NYA_Triangle_v1_zhCN",
    name: "Nya 三角形",
    values: [3, 0, 250, 0, null, 1, [1, 1, 1, 1], 0, [0, 0, 0, 1], 5, null],
    labels: ["点（边数）", "旋转", "外半径", "外圆度", "样式", "启用填充", "填充颜色", "启用描边", "描边颜色", "描边宽度", "__NYA_TRIANGLE_V1__"],
    groups: [5, 11],
    colors: [7, 9]
  },
  "star-zh-CN.ffx": {
    matchName: "Pseudo/NYA_Star_v2_zhCN",
    name: "Nya 星形",
    values: [5, 250, 125, 0, 0, 0, null, 1, [1, 1, 1, 1], 0, [0, 0, 0, 1], 5, null],
    labels: ["角数", "外半径", "内半径", "旋转", "外圆角", "内圆角", "样式", "启用填充", "填充颜色", "启用描边", "描边颜色", "描边宽度", "__NYA_STAR_V2__"],
    groups: [7, 13],
    colors: [9, 11]
  }
};

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

function createShapeLayer({
  invalidateVectorReferences = false,
  invalidPseudoSignature = false,
  invalidPseudoMatchName = false,
  invalidCircleParameter = false,
  invalidRoundedHeightType = false,
  roundedEffectName = "Nya 圆角矩形",
  roundedPathExpressionError = "",
  polygonEffectName = null,
  invalidPolygonParameter = false,
  roundnessSpelling = "Roundess",
  missingVectorProperty = "",
  polygonExpressionError = "",
  styleExpressionError = ""
} = {}) {
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
          if (name === missingVectorProperty) return null;
          if (matchName === "ADBE Vector Shape - Star" && /Round(ness|ess)$/.test(name) &&
              !name.endsWith(` ${roundnessSpelling}`)) return null;
          if (!states[name]) {
            states[name] = {
              value: null,
              expression: "",
              expressionEnabled: false,
              expressionError: matchName === "ADBE Vector Shape - Group" &&
                name === "ADBE Vector Shape" ? roundedPathExpressionError :
                matchName === "ADBE Vector Shape - Star" ? polygonExpressionError :
                matchName.startsWith("ADBE Vector Graphic - ") ? styleExpressionError : ""
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
      const circle = file.fsName.endsWith("/circle-zh-CN.ffx");
      const polygon = polygonPresets[file.fsName.split("/").pop()];
      const matchName = polygon?.matchName || (circle ? "Pseudo/NYA_Circle_v3_zhCN" : "Pseudo/NYA_RRect_v7_zhCN");
      const values = polygon?.values || (circle
        ? [250, null, 1, [1, 1, 1, 1], 0, [0, 0, 0, 1], 5, null]
        : [500, 500, 50, 0, null, 50, 50, 50, 50, null,
          null, 1, [1, 1, 1, 1], 0, [0, 0, 0, 1], 5, null]);
      const labels = polygon?.labels || (circle
        ? ["半径", "样式", "启用填充", "填充颜色", "启用描边", "描边颜色", "描边宽度", "__NYA_CIRCLE_V3__"]
        : ["宽度", "高度", "圆角值", "分离圆角", "分离参数", "左上角", "右上角",
          "右下角", "左下角", "", "样式", "启用填充", "填充颜色", "启用描边",
          "描边颜色", "描边宽度", "__NYA_RRECT_V7__"]);
      const groups = polygon?.groups || (circle ? [2, 8] : [5, 10, 11, 17]);
      const colors = polygon?.colors || (circle ? [4, 6] : [13, 15]);
      const parameters = values.map((value, offset) => ({
        name: invalidPseudoSignature && offset === values.length - 1 ? "__INVALID__" : labels[offset],
        matchName: ((invalidCircleParameter && circle && offset === 2) ||
          (invalidPolygonParameter && polygon && offset === 0))
          ? "Pseudo/Incorrect-0003"
          : `${matchName}-${String(offset + 1).padStart(4, "0")}`,
        propertyValueType: (invalidRoundedHeightType && !circle && !polygon && offset === 1) ||
          groups.includes(offset + 1) ? 6412 : colors.includes(offset + 1) ? 6418 : 6417,
        value: invalidRoundedHeightType && !circle && !polygon && offset === 1 ? null : value
      }));
      const effect = {
        matchName: invalidPseudoMatchName ? "Pseudo/Unexpected" : matchName,
        name: polygon ? (polygonEffectName || polygon.name) : circle ? "Nya 圆形" : roundedEffectName,
        numProperties: values.length + 1,
        property(index) { return parameters[index - 1] || null; },
        remove() {
          const index = controls.indexOf(effect);
          if (index !== -1) controls.splice(index, 1);
        }
      };
      controls.push(effect);
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

function evaluateCircleSize(layer, radius) {
  const ellipse = layer.vectors.find(vector => vector.matchName === "ADBE Vector Shape - Ellipse");
  const expression = ellipse.values["ADBE Vector Ellipse Size"].expression;
  return Function("effect", `${expression.replace("[r*2,r*2]", "return [r*2,r*2]")}`)(
    () => index => index === 1 ? radius : NaN
  );
}

function evaluateVectorProperty(layer, vectorMatchName, propertyName, overrides = {}) {
  const vector = layer.vectors.find(item => item.matchName === vectorMatchName);
  const property = vector.property(propertyName);
  if (!property.expression) return property.value;
  return Function("effect", `return (${property.expression});`)(name => {
    const effect = layer.controls.find(item => item.name === name);
    if (!effect) throw new Error(`Missing effect: ${name}`);
    return index => Object.hasOwn(overrides, index) ? overrides[index] : effect.property(index).value;
  });
}

const polygonProperty = (layer, name, overrides) =>
  evaluateVectorProperty(layer, "ADBE Vector Shape - Star", `ADBE Vector Star ${name}`, overrides);

describe("shape layer host action", () => {
  it("loads the AE-approved rounded rectangle identity alongside the circle candidate", async () => {
    const { app, created } = createApp();
    const { preflightPseudoEffectTemplate, runLayerAction } = await loadLayerHost(app);
    expect(preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS", "shape.roundedRectangle/v7/zh-CN"
    ).contract.matchName).toBe("Pseudo/NYA_RRect_v7_zhCN");
    expect(preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS", "shape.circle/v3/zh-CN"
    ).contract.matchName).toBe("Pseudo/NYA_Circle_v3_zhCN");
    expect(JSON.parse(runLayerAction(encoded("none")))).toMatchObject({ ok: true });
    expect(JSON.parse(runLayerAction(encoded("alt")))).toMatchObject({ ok: true });
    expect(created.map(layer => layer.controls[0].matchName)).toEqual([
      "Pseudo/NYA_Circle_v3_zhCN", "Pseudo/NYA_RRect_v7_zhCN"
    ]);
  });

  it("rejects pseudo-effect template ids outside the Host whitelist", async () => {
    const { app } = createApp();
    const { preflightPseudoEffectTemplate } = await loadLayerHost(app);

    expect(() => preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS",
      "shape.unknown/v1/zh-CN"
    )).toThrow("pseudo-template-not-allowed");
  });

  it("rejects the retired star v1 identity instead of reusing its loaded definition", async () => {
    const { app, created } = createApp();
    const { preflightPseudoEffectTemplate } = await loadLayerHost(app);
    expect(() => preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", "shape.star/v1/zh-CN"))
      .toThrow("pseudo-template-not-allowed");
    expect(created).toHaveLength(0);
  });

  it.each([
    ["a traversing asset path", (template) => { template.file = "../evil.ffx"; }],
    ["duplicate parameter indexes", (template) => { template.parameters.height = 1; }]
  ])("rejects catalog tampering with %s", async (_label, mutate) => {
    const { app } = createApp();
    const catalog = JSON.parse(await readFile("public/host/pseudo-effects/catalog.json", "utf8"));
    mutate(catalog.templates["shape.roundedRectangle/v7/zh-CN"]);
    app.catalogOverride = JSON.stringify(catalog);
    const { preflightPseudoEffectTemplate } = await loadLayerHost(app);

    expect(() => preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS",
      "shape.roundedRectangle/v7/zh-CN"
    )).toThrow("pseudo-template-invalid");
  });

  it("preflights the circle template using its own marker and parameter mapping", async () => {
    const { app } = createApp();
    const { preflightPseudoEffectTemplate } = await loadLayerHost(app);
    const template = preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", "shape.circle/v3/zh-CN");
    expect(template.file.fsName).toBe("C:/CEP/NYAWORKS/host/pseudo-effects/circle-zh-CN.ffx");
    expect(template.definition.parameters).toEqual({
      radius: 1, fillEnabled: 3, fillColor: 4,
      strokeEnabled: 5, strokeColor: 6, strokeWidth: 7
    });
    expect(template.contract.marker).toEqual({ index: 8, name: "__NYA_CIRCLE_V3__" });
  });

  it.each([
    ["wrong marker", template => { template.marker.index = 7; }],
    ["duplicate parameter index", template => { template.parameters.strokeWidth = 3; }],
    ["swapped style indexes", template => {
      template.parameters.fillEnabled = 4;
      template.parameters.fillColor = 3;
    }]
  ])("rejects the circle catalog with %s before touching AE", async (_label, mutate) => {
    const { app, created } = createApp();
    const catalog = JSON.parse(await readFile("public/host/pseudo-effects/catalog.json", "utf8"));
    mutate(catalog.templates["shape.circle/v3/zh-CN"]);
    app.catalogOverride = JSON.stringify(catalog);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("alt")))).toMatchObject({
      ok: false, detail: expect.stringContaining("pseudo-template-invalid")
    });
    expect(created).toHaveLength(0);
  });

  it("reports malformed pseudo-effect catalogs as invalid", async () => {
    const { app } = createApp();
    app.catalogOverride = "{";
    const { preflightPseudoEffectTemplate } = await loadLayerHost(app);

    expect(() => preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS",
      "shape.roundedRectangle/v7/zh-CN"
    )).toThrow("pseudo-catalog-invalid");
  });

  it("reuses one valid pseudo-effect instance without resetting its parameters", async () => {
    const { app, created } = createApp();
    const comp = app.project.activeItem;
    const layer = comp.layers.addShape();
    const { preflightPseudoEffectTemplate, applyPseudoEffectTemplate } = await loadLayerHost(app);
    const template = preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS",
      "shape.roundedRectangle/v7/zh-CN"
    );
    const context = { comp, selection: [] };

    const first = applyPseudoEffectTemplate(layer, context, template);
    first.property(1).value = 777;
    const second = applyPseudoEffectTemplate(layer, context, template);

    expect(created).toHaveLength(1);
    expect(layer.controls).toHaveLength(1);
    expect(second).toBe(first);
    expect(second.property(1).value).toBe(777);
  });

  it("keeps shape-template routing free of unparenthesized chained conditionals unsupported by ExtendScript", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const file = ts.createSourceFile("index.jsx", source, ts.ScriptTarget.ES3, true, ts.ScriptKind.JS);
    const unsafeRoutes = [];
    function inspectRoute(node) {
      if (ts.isConditionalExpression(node) && ts.isConditionalExpression(node.whenFalse)) {
        unsafeRoutes.push(node.getText(file));
      }
      ts.forEachChild(node, inspectRoute);
    }
    function findShapeCreation(node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "createShapeLayer") {
        inspectRoute(node);
      } else {
        ts.forEachChild(node, findShapeCreation);
      }
    }
    findShapeCreation(file);
    expect(unsafeRoutes).toEqual([]);
  });

  it.each([
    ["createRoundedRectangleShape", "shape.circle/v3/zh-CN"],
    ["createEllipseShape", "shape.roundedRectangle/v7/zh-CN"]
  ])("%s rejects a valid template for the other shape before adding properties", async (builder, wrongId) => {
    const { app } = createApp();
    const host = await loadLayerHost(app);
    const comp = app.project.activeItem;
    const layer = comp.layers.addShape();
    const contents = layer.property("ADBE Root Vectors Group")
      .addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    const template = host.preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", wrongId);
    expect(() => host[builder](layer, contents, { comp, selection: [] }, template))
      .toThrow("pseudo-template-shape-mismatch");
    expect(layer.controls).toHaveLength(0);
    expect(layer.vectors).toHaveLength(0);
  });

  it("rejects ambiguous existing pseudo-effect instances without adding another", async () => {
    const { app } = createApp();
    const comp = app.project.activeItem;
    const layer = comp.layers.addShape();
    const { preflightPseudoEffectTemplate, applyPseudoEffectTemplate } = await loadLayerHost(app);
    const template = preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS",
      "shape.roundedRectangle/v7/zh-CN"
    );
    layer.applyPreset(template.file);
    layer.applyPreset(template.file);

    expect(() => applyPseudoEffectTemplate(layer, {
      comp,
      selection: []
    }, template)).toThrow("pseudo-effect-ambiguous");
    expect(layer.controls).toHaveLength(2);
  });

  it("cleans only newly added invalid effects and restores layer and property selection", async () => {
    const { app } = createApp({ invalidPseudoSignature: true });
    const comp = app.project.activeItem;
    const original = { selected: true };
    const selectedProperty = { selected: true };
    comp.selectedLayers = [original];
    comp.selectedProperties = [selectedProperty];
    const layer = comp.layers.addShape();
    const effects = layer.property("ADBE Effect Parade");
    const existing = effects.addProperty("ADBE Slider Control");
    const { preflightPseudoEffectTemplate, applyPseudoEffectTemplate } = await loadLayerHost(app);
    const template = preflightPseudoEffectTemplate(
      "C:/CEP/NYAWORKS",
      "shape.roundedRectangle/v7/zh-CN"
    );

    expect(() => applyPseudoEffectTemplate(layer, {
      comp,
      selection: [original]
    }, template)).toThrow("pseudo-effect-signature-mismatch");
    expect(layer.controls).toEqual([existing]);
    expect(original.selected).toBe(true);
    expect(selectedProperty.selected).toBe(true);
    expect(layer.selected).toBe(false);
  });

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

  it("binds rounded rectangle geometry and style to the actual preset effect name", async () => {
    const { app, created } = createApp({ roundedEffectName: "AE 载入的圆角矩形" });
    const run = await loadRunLayerAction(app);

    expect(JSON.parse(run(encoded("none")))).toMatchObject({ ok: true });
    const layer = created[0];
    const effectName = layer.controls[0].name;
    const path = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Shape - Group");
    const expression = path.values["ADBE Vector Shape"].expression;
    const effect = (name) => {
      if (name !== effectName) throw new Error(`Missing effect: ${name}`);
      return (index) => [null, 500, 500, 50, 0, null, 50, 50, 50, 50][index];
    };
    const result = Function("effect", "createPath",
      expression.replace("createPath(points,ins,outs,true);", "return createPath(points,ins,outs,true);"))(
      effect, (points) => points
    );
    expect(result).toHaveLength(8);
    const fill = layer.vectors.find((vector) => vector.matchName === "ADBE Vector Graphic - Fill");
    const opacity = fill.values["ADBE Vector Fill Opacity"].expression;
    expect(Function("effect", `return ${opacity}`)(
      (name) => {
        if (name !== effectName) throw new Error(`Missing effect: ${name}`);
        return (index) => index === 12 ? 1 : 0;
      }
    )).toBe(100);
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

  it("includes the AE path expression error when rounded rectangle creation fails and cleans the layer", async () => {
    const { app, created } = createApp({
      invalidRoundedHeightType: true,
      roundedPathExpressionError: "AE: effect Nya 圆角矩形 is missing at line 1"
    });
    const run = await loadRunLayerAction(app);
    const result = JSON.parse(run(encoded("none")));

    expect(result).toMatchObject({
      ok: false,
      detail: expect.stringContaining("p2=高度/6412/object/null")
    });
    expect(result.detail).toContain("AE: effect Nya 圆角矩形 is missing at line 1");
    expect(created).toHaveLength(0);
  });

  it("retains preset path and actual parameter snapshots after a type failure removes the layer", async () => {
    const { app, created } = createApp({
      invalidRoundedHeightType: true,
      roundedEffectName: "Nya 圆形",
      roundedPathExpressionError: "wrong argument type at line 2"
    });
    const host = await loadLayerHost(app);
    expect(JSON.parse(host.runLayerAction(encoded("none"))).ok).toBe(false);
    expect(created).toHaveLength(0);
    const trace = JSON.parse(host.getLastShapePseudoTrace());
    expect(trace).toMatchObject({
      revision: "shape-boundary-1", modifier: "none",
      templateId: "shape.roundedRectangle/v7/zh-CN",
      file: "C:/CEP/NYAWORKS/host/pseudo-effects/rounded-rectangle-zh-CN.ffx",
      expectedMatchName: "Pseudo/NYA_RRect_v7_zhCN",
      effectReference: 'effect("Nya 圆形")',
      expressionError: "wrong argument type at line 2"
    });
    expect(trace.snapshots.map(row => row.stage)).toEqual([
      "after-apply-before-validation", "after-validation", "before-path-expression",
      "after-path-expression-error"
    ]);
    for (const row of trace.snapshots) {
      expect(row).toMatchObject({ name: "Nya 圆形", matchName: trace.expectedMatchName });
      expect(row.parameters[1]).toMatchObject({ index: 2, valueType: "6412", value: null });
      expect(row.parameters[16].name).toBe("__NYA_RRECT_V7__");
    }
  });

  it("places the circle stroke over its fill so increasing radius cannot hide the inner stroke", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);

    expect(JSON.parse(run(encoded("alt")))).toMatchObject({ ok: true });
    const paint = created[0].vectors.filter((vector) =>
      vector.matchName === "ADBE Vector Graphic - Fill" ||
      vector.matchName === "ADBE Vector Graphic - Stroke"
    );
    // AE paints this group bottom-to-top in the timeline; the first operator is on top.
    expect(paint.map((vector) => vector.matchName)).toEqual([
      "ADBE Vector Graphic - Stroke", "ADBE Vector Graphic - Fill"
    ]);
    expect(paint[0].property("ADBE Vector Stroke Width").expression).toContain('(7)');
    expect(paint[1].property("ADBE Vector Fill Opacity").expression).toContain('(3)>0?100:0');
  });

  it("creates an Alt circle with one independent pseudo effect and radius-driven native ellipse", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("alt")))).toMatchObject({ ok: true, createdLayers: 1 });
    const layer = created[0];
    expect(layer.name).toBe("Nya 圆");
    expect(layer.position.value).toEqual([960, 540]);
    expect(layer.controls.map(control => control.matchName)).toEqual(["Pseudo/NYA_Circle_v3_zhCN"]);
    expect(evaluateCircleSize(layer, 250)).toEqual([500, 500]);
    expect(evaluateCircleSize(layer, 2203)).toEqual([4406, 4406]);
    const fill = layer.vectors.find(vector => vector.matchName === "ADBE Vector Graphic - Fill");
    const stroke = layer.vectors.find(vector => vector.matchName === "ADBE Vector Graphic - Stroke");
    expect(fill.values["ADBE Vector Fill Opacity"].expression).toContain('(3)>0?100:0');
    expect(fill.values["ADBE Vector Fill Color"].expression).toContain('(4)');
    expect(stroke.values["ADBE Vector Stroke Opacity"].expression).toContain('(5)>0?100:0');
    expect(stroke.values["ADBE Vector Stroke Color"].expression).toContain('(6)');
    expect(stroke.values["ADBE Vector Stroke Width"].expression).toContain('(7)');
    for (const vector of [fill, stroke]) {
      for (const state of Object.values(vector.values)) {
        expect(state.expressionError).toBe("");
      }
    }
  });

  it("reacquires the circle's fill/stroke after indexed-group changes invalidate prior references", async () => {
    const { app, created } = createApp({ invalidateVectorReferences: true });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("alt")))).toMatchObject({ ok: true });
    const fill = created[0].vectors.find(vector => vector.matchName === "ADBE Vector Graphic - Fill");
    expect(fill.property("ADBE Vector Fill Opacity").expression).toContain('(3)>0?100:0');
    const stroke = created[0].vectors.find(vector => vector.matchName === "ADBE Vector Graphic - Stroke");
    expect(stroke.property("ADBE Vector Stroke Width").expression).toContain('(7)');
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

  it("refuses a missing circle preset before creating an Alt layer", async () => {
    const { app, created } = createApp();
    app.missingCirclePreset = true;
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("alt")))).toMatchObject({
      ok: false, detail: expect.stringContaining("pseudo-template-missing")
    });
    expect(created).toHaveLength(0);
  });

  it.each([
    ["signature", { invalidPseudoSignature: true }, "pseudo-effect-signature-mismatch"],
    ["parameter", { invalidCircleParameter: true }, "pseudo-parameter-mismatch-fillEnabled"]
  ])("removes only the new Alt layer after a %s mismatch", async (_label, options, detail) => {
    const { app, created } = createApp(options);
    const comp = app.project.activeItem;
    const original = { selected: true, index: 1, inPoint: 0, outPoint: 10 };
    comp.selectedLayers = [original];
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("alt")))).toMatchObject({
      ok: false, detail: expect.stringContaining(detail)
    });
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
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

  it("creates Ctrl as a centered polygon with one nine-parameter triangle pseudo effect", async () => {
    const { app, created } = createApp();
    const host = await loadLayerHost(app);
    expect(JSON.parse(host.runLayerAction(encoded("ctrl")))).toMatchObject({ ok: true, createdLayers: 1 });
    const layer = created[0];
    expect(layer.name).toBe("Nya 三角形");
    expect(layer.position.value).toEqual([960, 540]);
    expect(layer.anchor.value).toEqual([0, 0]);
    expect(layer.controls.map(item => item.matchName)).toEqual(["Pseudo/NYA_Triangle_v1_zhCN"]);
    const effect = layer.controls[0];
    expect(Array.from({ length: 11 }, (_, i) => effect.property(i + 1).name)).toEqual(polygonPresets["triangle-zh-CN.ffx"].labels);
    expect(polygonProperty(layer, "Type")).toBe(2);
    expect(polygonProperty(layer, "Points")).toBe(3);
    expect(polygonProperty(layer, "Outer Radius")).toBe(250);
    expect(polygonProperty(layer, "Rotation")).toBe(0);
    expect(polygonProperty(layer, "Outer Roundess")).toBe(0);
    expect(host.preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", "shape.triangle/v1/zh-CN").definition.parameters).toEqual({
      points: 1, rotation: 2, outerRadius: 3, outerRoundness: 4,
      fillEnabled: 6, fillColor: 7, strokeEnabled: 8, strokeColor: 9, strokeWidth: 10
    });
  });

  it("drives triangle sides, radius, native angles and roundness at boundaries", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("ctrl")))).toMatchObject({ ok: true });
    const layer = created[0];
    for (const [input, expected] of [[-1, 3], [3, 3], [4, 4], [4.6, 5], [20, 20], [100, 100], [120, 100]]) {
      expect(polygonProperty(layer, "Points", { 1: input })).toBe(expected);
    }
    for (const radius of [0, 250, 3000, 5000]) {
      expect(polygonProperty(layer, "Outer Radius", { 3: radius })).toBe(radius);
    }
    expect(polygonProperty(layer, "Outer Radius", { 3: -1 })).toBe(0);
    for (const angle of [-720, -90, 0, 45.5, 720]) {
      expect(polygonProperty(layer, "Rotation", { 2: angle })).toBe(angle);
    }
    for (const [input, expected] of [[-1, 0], [0, 0], [50, 50], [100, 100], [120, 100]]) {
      expect(polygonProperty(layer, "Outer Roundess", { 4: input })).toBe(expected);
    }
  });

  it("binds triangle geometry and style to the actual instance name, including escaped names", async () => {
    const { app, created } = createApp({ polygonEffectName: '用户 "三角形" \\ 新名' });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("ctrl")))).toMatchObject({ ok: true });
    const layer = created[0];
    expect(polygonProperty(layer, "Points", { 1: 7 })).toBe(7);
    expect(evaluateVectorProperty(layer, "ADBE Vector Graphic - Fill", "ADBE Vector Fill Color")).toEqual([1, 1, 1, 1]);
    expect(evaluateVectorProperty(layer, "ADBE Vector Graphic - Stroke", "ADBE Vector Stroke Width")).toBe(5);
  });

  it.each(["Roundness", "Roundess"])("uses the available triangle outer %s property", async spelling => {
    const { app, created } = createApp({ roundnessSpelling: spelling });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("ctrl")))).toMatchObject({ ok: true });
    expect(polygonProperty(created[0], `Outer ${spelling}`, { 4: 67 })).toBe(67);
  });

  it("reacquires triangle paint properties and keeps its stroke above fill", async () => {
    const { app, created } = createApp({ invalidateVectorReferences: true });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("ctrl")))).toMatchObject({ ok: true });
    const layer = created[0];
    expect(layer.vectors.map(item => item.matchName)).toEqual([
      "ADBE Vector Shape - Star", "ADBE Vector Graphic - Stroke", "ADBE Vector Graphic - Fill"
    ]);
    const paint = (operator, property, overrides) => evaluateVectorProperty(
      layer, `ADBE Vector Graphic - ${operator}`, `ADBE Vector ${operator} ${property}`, overrides
    );
    expect(paint("Fill", "Opacity")).toBe(100);
    expect(paint("Stroke", "Opacity")).toBe(0);
    expect(paint("Fill", "Opacity", { 6: 0 })).toBe(0);
    expect(paint("Stroke", "Opacity", { 8: 1 })).toBe(100);
    expect(paint("Fill", "Color")).toEqual([1, 1, 1, 1]);
    expect(paint("Stroke", "Color")).toEqual([0, 0, 0, 1]);
    expect(paint("Fill", "Color", { 7: [0.2, 0.4, 0.8, 1] })).toEqual([0.2, 0.4, 0.8, 1]);
    expect(paint("Stroke", "Color", { 9: [1, 0.1, 0.3, 1] })).toEqual([1, 0.1, 0.3, 1]);
    for (const width of [0, 5, 100, 500, 1000]) expect(paint("Stroke", "Width", { 10: width })).toBe(width);
    expect(paint("Stroke", "Width", { 10: -5 })).toBe(0);
    expect(polygonProperty(layer, "Points", { 1: 8 })).toBe(8);
  });

  it.each(["shape.circle/v3/zh-CN", "shape.roundedRectangle/v7/zh-CN"])(
    "rejects %s in the triangle builder before adding geometry or effects", async wrongId => {
      const { app } = createApp();
      const host = await loadLayerHost(app);
      const comp = app.project.activeItem;
      const layer = comp.layers.addShape();
      const contents = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
      const template = host.preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", wrongId);
      expect(() => host.createPolygonShape(layer, contents, false, { comp, selection: [] }, template))
        .toThrow("pseudo-template-shape-mismatch");
      expect(layer.controls).toHaveLength(0);
      expect(layer.vectors).toHaveLength(0);
    }
  );

  it("rejects a shifted triangle catalog before adding a layer", async () => {
    const { app, created } = createApp();
    const catalog = JSON.parse(await readFile("public/host/pseudo-effects/catalog.json", "utf8"));
    catalog.templates["shape.triangle/v1/zh-CN"].parameters.rotation = 3;
    app.catalogOverride = JSON.stringify(catalog);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("ctrl")))).toMatchObject({ ok: false, detail: expect.stringContaining("pseudo-template-invalid") });
    expect(created).toHaveLength(0);
  });

  it.each([
    ["missing template", "missingTrianglePreset", "pseudo-template-missing"],
    ["missing root", "missingRoot", "pseudo-extension-root-unavailable"]
  ])("rejects triangle %s before creating a layer", async (_label, flag, detail) => {
    const { app, created } = createApp();
    app[flag] = true;
    const run = await loadRunLayerAction(app);
    const payload = flag === "missingRoot" ? encodeURIComponent(JSON.stringify({ action: "create-shape", modifier: "ctrl" })) : encoded("ctrl");
    expect(JSON.parse(run(payload))).toMatchObject({ ok: false, detail: expect.stringContaining(detail) });
    expect(created).toHaveLength(0);
  });

  it.each([
    ["signature", { invalidPseudoSignature: true }, "pseudo-effect-signature-mismatch"],
    ["parameter", { invalidPolygonParameter: true }, "pseudo-parameter-mismatch-points"],
    ["missing geometry", { missingVectorProperty: "ADBE Vector Star Outer Radius" }, "pseudo-geometry-properties-unavailable"],
    ["missing roundness", { roundnessSpelling: "unavailable" }, "pseudo-geometry-properties-unavailable"],
    ["geometry expression", { polygonExpressionError: "AE geometry failure" }, "pseudo-expression-invalid"],
    ["missing style", { missingVectorProperty: "ADBE Vector Stroke Width" }, "pseudo-style-properties-unavailable"],
    ["style expression", { styleExpressionError: "AE style failure" }, "pseudo-style-expression-invalid"]
  ])("cleans only the new triangle and restores selection after %s failure", async (_label, options, detail) => {
    const { app, created } = createApp(options);
    const comp = app.project.activeItem;
    const original = { selected: true, index: 1, inPoint: 0, outPoint: 10 };
    const property = { selected: true };
    comp.selectedLayers = [original];
    comp.selectedProperties = [property];
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("ctrl")))).toMatchObject({ ok: false, detail: expect.stringContaining(detail) });
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
    expect(property.selected).toBe(true);
  });

  it("creates Shift as a centered star with one eleven-parameter pseudo effect", async () => {
    const { app, created } = createApp();
    const host = await loadLayerHost(app);
    expect(JSON.parse(host.runLayerAction(encoded("shift")))).toMatchObject({ ok: true, createdLayers: 1 });
    const layer = created[0];
    expect(layer.name).toBe("Nya 星形");
    expect(layer.position.value).toEqual([960, 540]);
    expect(layer.anchor.value).toEqual([0, 0]);
    expect(layer.controls.map(item => item.matchName)).toEqual(["Pseudo/NYA_Star_v2_zhCN"]);
    const effect = layer.controls[0];
    expect(Array.from({ length: 13 }, (_, i) => effect.property(i + 1).name)).toEqual(polygonPresets["star-zh-CN.ffx"].labels);
    expect(polygonProperty(layer, "Type")).toBe(1);
    expect(polygonProperty(layer, "Points")).toBe(5);
    expect(polygonProperty(layer, "Outer Radius")).toBe(250);
    expect(polygonProperty(layer, "Inner Radius")).toBe(125);
    expect(polygonProperty(layer, "Rotation")).toBe(0);
    expect(polygonProperty(layer, "Outer Roundess")).toBe(0);
    expect(polygonProperty(layer, "Inner Roundess")).toBe(0);
    const template = host.preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", "shape.star/v2/zh-CN");
    expect(template.definition.parameters).toEqual({
      points: 1, outerRadius: 2, innerRadius: 3, rotation: 4, outerRoundness: 5, innerRoundness: 6,
      fillEnabled: 8, fillColor: 9, strokeEnabled: 10, strokeColor: 11, strokeWidth: 12
    });
    expect(template.contract.marker).toEqual({ index: 13, name: "__NYA_STAR_V2__" });
  });

  it("drives star corners, independent radii, native angles and both roundness values at boundaries", async () => {
    const { app, created } = createApp();
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("shift")))).toMatchObject({ ok: true });
    const layer = created[0];
    // AE's native Polystar Points minimum is 3 for both polygon and star.
    for (const [input, expected] of [[-1, 3], [2, 3], [2.5, 3], [3, 3], [5, 5], [5.6, 6], [20, 20], [100, 100], [120, 100]]) {
      expect(polygonProperty(layer, "Points", { 1: input })).toBe(expected);
    }
    for (const radius of [0, 250, 3000, 5000]) {
      expect(polygonProperty(layer, "Outer Radius", { 2: radius })).toBe(radius);
    }
    for (const [inner, outer, expected] of [[125, 250, 125], [350, 250, 250], [-1, 250, 0], [125, 0, 0], [125, -1, 0], [5000, 5000, 5000]]) {
      expect(polygonProperty(layer, "Inner Radius", { 2: outer, 3: inner })).toBe(expected);
    }
    for (const angle of [-720, -90, 0, 45.5, 720]) {
      expect(polygonProperty(layer, "Rotation", { 4: angle })).toBe(angle);
    }
    for (const [input, expected] of [[-1, 0], [0, 0], [50, 50], [100, 100], [120, 100]]) {
      expect(polygonProperty(layer, "Outer Roundess", { 5: input })).toBe(expected);
      expect(polygonProperty(layer, "Inner Roundess", { 6: input })).toBe(expected);
    }
  });

  it("binds all star geometry and paint to its actual effect name after indexed-group invalidation", async () => {
    const { app, created } = createApp({ polygonEffectName: '用户 "星形" \\ 新名', invalidateVectorReferences: true });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("shift")))).toMatchObject({ ok: true });
    const layer = created[0];
    expect(layer.vectors.map(item => item.matchName)).toEqual([
      "ADBE Vector Shape - Star", "ADBE Vector Graphic - Stroke", "ADBE Vector Graphic - Fill"
    ]);
    expect(polygonProperty(layer, "Points", { 1: 9 })).toBe(9);
    const paint = (operator, property, overrides) => evaluateVectorProperty(
      layer, `ADBE Vector Graphic - ${operator}`, `ADBE Vector ${operator} ${property}`, overrides
    );
    expect(paint("Fill", "Opacity")).toBe(100);
    expect(paint("Stroke", "Opacity")).toBe(0);
    expect(paint("Fill", "Opacity", { 8: 0 })).toBe(0);
    expect(paint("Stroke", "Opacity", { 10: 1 })).toBe(100);
    expect(paint("Fill", "Color")).toEqual([1, 1, 1, 1]);
    expect(paint("Stroke", "Color")).toEqual([0, 0, 0, 1]);
    expect(paint("Fill", "Color", { 9: [0.2, 0.4, 0.8, 1] })).toEqual([0.2, 0.4, 0.8, 1]);
    expect(paint("Stroke", "Color", { 11: [1, 0.1, 0.3, 1] })).toEqual([1, 0.1, 0.3, 1]);
    for (const width of [0, 5, 100, 500, 1000]) expect(paint("Stroke", "Width", { 12: width })).toBe(width);
    expect(paint("Stroke", "Width", { 12: -5 })).toBe(0);
  });

  it.each(["Roundness", "Roundess"])("uses the available star inner and outer %s properties", async spelling => {
    const { app, created } = createApp({ roundnessSpelling: spelling });
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("shift")))).toMatchObject({ ok: true });
    expect(polygonProperty(created[0], `Outer ${spelling}`, { 5: 67 })).toBe(67);
    expect(polygonProperty(created[0], `Inner ${spelling}`, { 6: 37 })).toBe(37);
  });

  it.each([
    [true, "shape.triangle/v1/zh-CN"],
    [true, "shape.circle/v3/zh-CN"],
    [true, "shape.roundedRectangle/v7/zh-CN"],
    [false, "shape.star/v2/zh-CN"]
  ])("rejects cross-shape templates before polygon builder isStar=%s can add properties (%s)", async (isStar, wrongId) => {
    const { app } = createApp();
    const host = await loadLayerHost(app);
    const comp = app.project.activeItem;
    const layer = comp.layers.addShape();
    const contents = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    const template = host.preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", wrongId);
    expect(() => host.createPolygonShape(layer, contents, isStar, { comp, selection: [] }, template))
      .toThrow("pseudo-template-shape-mismatch");
    expect(layer.controls).toHaveLength(0);
    expect(layer.vectors).toHaveLength(0);
  });

  it.each([
    ["createRoundedRectangleShape", "shape.triangle/v1/zh-CN"],
    ["createRoundedRectangleShape", "shape.star/v2/zh-CN"],
    ["createEllipseShape", "shape.triangle/v1/zh-CN"],
    ["createEllipseShape", "shape.star/v2/zh-CN"]
  ])("%s rejects the new %s template before touching the approved geometry", async (builder, wrongId) => {
    const { app } = createApp();
    const host = await loadLayerHost(app);
    const comp = app.project.activeItem;
    const layer = comp.layers.addShape();
    const contents = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    const template = host.preflightPseudoEffectTemplate("C:/CEP/NYAWORKS", wrongId);
    expect(() => host[builder](layer, contents, { comp, selection: [] }, template)).toThrow("pseudo-template-shape-mismatch");
    expect(layer.controls).toHaveLength(0);
    expect(layer.vectors).toHaveLength(0);
  });

  it("rejects a shifted star catalog and a missing star preset without creating a layer", async () => {
    const { app, created } = createApp();
    const catalog = JSON.parse(await readFile("public/host/pseudo-effects/catalog.json", "utf8"));
    catalog.templates["shape.star/v2/zh-CN"].parameters.outerRoundness = 6;
    app.catalogOverride = JSON.stringify(catalog);
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("shift")))).toMatchObject({ ok: false, detail: expect.stringContaining("pseudo-template-invalid") });
    app.catalogOverride = null;
    app.missingStarPreset = true;
    expect(JSON.parse(run(encoded("shift")))).toMatchObject({ ok: false, detail: expect.stringContaining("pseudo-template-missing") });
    expect(created).toHaveLength(0);
  });

  it.each([
    ["signature", { invalidPseudoSignature: true }, "pseudo-effect-signature-mismatch"],
    ["parameter", { invalidPolygonParameter: true }, "pseudo-parameter-mismatch-points"],
    ["missing inner radius", { missingVectorProperty: "ADBE Vector Star Inner Radius" }, "pseudo-geometry-properties-unavailable"],
    ["missing roundness", { roundnessSpelling: "unavailable" }, "pseudo-geometry-properties-unavailable"],
    ["geometry expression", { polygonExpressionError: "AE geometry failure" }, "pseudo-expression-invalid"],
    ["missing style", { missingVectorProperty: "ADBE Vector Stroke Width" }, "pseudo-style-properties-unavailable"],
    ["style expression", { styleExpressionError: "AE style failure" }, "pseudo-style-expression-invalid"]
  ])("cleans only the new star and restores selection after %s failure", async (_label, options, detail) => {
    const { app, created } = createApp(options);
    const comp = app.project.activeItem;
    const original = { selected: true, index: 1, inPoint: 0, outPoint: 10 };
    const property = { selected: true };
    comp.selectedLayers = [original];
    comp.selectedProperties = [property];
    const run = await loadRunLayerAction(app);
    expect(JSON.parse(run(encoded("shift")))).toMatchObject({ ok: false, detail: expect.stringContaining(detail) });
    expect(created).toHaveLength(0);
    expect(original.selected).toBe(true);
    expect(property.selected).toBe(true);
  });

  it("keeps all four template identities and geometry correct through none-alt-ctrl-shift-none-alt", async () => {
    const { app, created } = createApp();
    const host = await loadLayerHost(app);
    const scenarios = [
      ["none", "Pseudo/NYA_RRect_v7_zhCN"], ["alt", "Pseudo/NYA_Circle_v3_zhCN"],
      ["ctrl", "Pseudo/NYA_Triangle_v1_zhCN"], ["shift", "Pseudo/NYA_Star_v2_zhCN"],
      ["none", "Pseudo/NYA_RRect_v7_zhCN"], ["alt", "Pseudo/NYA_Circle_v3_zhCN"]
    ];
    const actual = [];
    for (const [modifier, matchName] of scenarios) {
      expect(JSON.parse(host.runLayerAction(encoded(modifier)))).toMatchObject({ ok: true, createdLayers: 1 });
      const layer = created[0];
      expect(layer.controls).toHaveLength(1);
      actual.push(layer.controls[0].matchName);
      expect(JSON.parse(host.getLastShapePseudoTrace()).expectedMatchName).toBe(matchName);
      if (modifier === "none") expect(evaluateRoundedPath(layer, [null, 500, 500, 50, 0, null, 50, 50, 50, 50]).closed).toBe(true);
      if (modifier === "alt") expect(evaluateCircleSize(layer, 250)).toEqual([500, 500]);
      if (modifier === "ctrl") expect(polygonProperty(layer, "Points", { 1: 4 })).toBe(4);
      if (modifier === "shift") expect(polygonProperty(layer, "Inner Radius", { 2: 100, 3: 200 })).toBe(100);
    }
    expect(actual).toEqual(scenarios.map(([, matchName]) => matchName));
    expect(created).toHaveLength(6);
  });
});
