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
      /^C:\/CEP\/NYAWORKS\/host\/pseudo-effects\/(catalog\.json|rounded-rectangle-zh-CN\.ffx|circle-zh-CN\.ffx)$/.test(path);
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
  roundedPathExpressionError = ""
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
          if (!states[name]) {
            states[name] = {
              value: null,
              expression: "",
              expressionEnabled: false,
              expressionError: matchName === "ADBE Vector Shape - Group" &&
                name === "ADBE Vector Shape" ? roundedPathExpressionError : ""
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
      const matchName = circle ? "Pseudo/NYA_Circle_v3_zhCN" : "Pseudo/NYA_RRect_v7_zhCN";
      const values = circle
        ? [250, null, 1, [1, 1, 1, 1], 0, [0, 0, 0, 1], 5, null]
        : [500, 500, 50, 0, null, 50, 50, 50, 50, null,
          null, 1, [1, 1, 1, 1], 0, [0, 0, 0, 1], 5, null];
      const labels = circle
        ? ["半径", "样式", "启用填充", "填充颜色", "启用描边", "描边颜色", "描边宽度", "__NYA_CIRCLE_V3__"]
        : ["宽度", "高度", "圆角值", "分离圆角", "分离参数", "左上角", "右上角",
          "右下角", "左下角", "", "样式", "启用填充", "填充颜色", "启用描边",
          "描边颜色", "描边宽度", "__NYA_RRECT_V7__"];
      const parameters = values.map((value, offset) => ({
        name: invalidPseudoSignature && offset === values.length - 1 ? "__INVALID__" : labels[offset],
        matchName: invalidCircleParameter && circle && offset === 2
          ? "Pseudo/Incorrect-0003"
          : `${matchName}-${String(offset + 1).padStart(4, "0")}`,
        propertyValueType: (invalidRoundedHeightType && !circle && offset === 1) ||
          (circle ? [2, 8] : [5, 10, 11, 17]).includes(offset + 1) ? 6412 : 6417,
        value: invalidRoundedHeightType && !circle && offset === 1 ? null : value
      }));
      const effect = {
        matchName: invalidPseudoMatchName ? "Pseudo/Unexpected" : matchName,
        name: circle ? "Nya 圆形" : roundedEffectName,
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

  it.each([
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
