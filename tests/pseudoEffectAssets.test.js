import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { REQUIRED_DIST_FILES } from "../scripts/dist-contract.mjs";

const root = "public/host/pseudo-effects";
const id = "shape.roundedRectangle/v7/zh-CN";

function parseRifx(bytes, start = 0, end = bytes.length) {
  const result = [];
  for (let at = start; at < end;) {
    const tag = bytes.toString("ascii", at, at + 4);
    const length = bytes.readUInt32BE(at + 4);
    const node = { tag };
    if (tag === "RIFX" || tag === "LIST") {
      node.type = bytes.toString("ascii", at + 8, at + 12);
      node.children = parseRifx(bytes, at + 12, at + 8 + length);
    } else {
      node.data = bytes.subarray(at + 8, at + 8 + length);
    }
    result.push(node);
    at += 8 + length + length % 2;
  }
  return result;
}

function findChunk(node, type) {
  if (node.type === type) return node;
  for (const child of node.children || []) {
    const found = findChunk(child, type);
    if (found) return found;
  }
  return null;
}

async function readLayoutFunction() {
  const source = await readFile("scripts/build-shape-pseudo-effects.mjs", "utf8");
  const { validateShapeStrokeWidth } = await import("../scripts/shape-pseudo-effect-contract.mjs");
  // Exercise the CLI's real pure layout functions without running its file writes.
  const functions = source.slice(source.indexOf("function numericParameter("), source.indexOf("\nfunction parse("));
  return runInNewContext(`${functions}\nlayoutParameters`, { validateShapeStrokeWidth });
}

describe("rounded rectangle pseudo-effect asset", () => {
  it("requires all four version-free presets and their catalog in production builds", () => {
    expect(REQUIRED_DIST_FILES).toContain("dist/host/pseudo-effects/catalog.json");
    expect(REQUIRED_DIST_FILES.filter(file => file.endsWith(".ffx"))).toEqual([
      "dist/host/pseudo-effects/rounded-rectangle-zh-CN.ffx",
      "dist/host/pseudo-effects/circle-zh-CN.ffx",
      "dist/host/pseudo-effects/triangle-zh-CN.ffx",
      "dist/host/pseudo-effects/star-zh-CN.ffx"
    ]);
  });

  it("ships the last AE-approved v7 round-rectangle preset unchanged", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const template = catalog.templates[id];
    expect(template.sha256).toBe("D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9");
    expect(Object.keys(catalog.templates)).toEqual([
      "shape.roundedRectangle/v7/zh-CN", "shape.circle/v3/zh-CN",
      "shape.triangle/v1/zh-CN", "shape.star/v2/zh-CN"
    ]);
    expect(template.matchName).toBe("Pseudo/NYA_RRect_v7_zhCN");
    expect(template.file).toBe("rounded-rectangle-zh-CN.ffx");
    expect(template.marker).toMatchObject({ index: 17, name: "__NYA_RRECT_V7__" });
    expect(template.parameters).toEqual({
      width: 1, height: 2, radius: 3, separate: 4,
      topLeftPercent: 6, topRightPercent: 7,
      bottomRightPercent: 8, bottomLeftPercent: 9,
      fillEnabled: 12, fillColor: 13,
      strokeEnabled: 14, strokeColor: 15, strokeWidth: 16
    });
    const schema = JSON.parse(
      await readFile("assets/pseudo-effects/rounded-rectangle/v7/schema.json", "utf8")
    );
    for (const parameterId of ["width", "height"]) {
      expect(schema.parameters.find(({ id }) => id === parameterId)).toMatchObject({
        defaultValue: 500,
        sliderMin: 0,
        sliderMax: 4000,
        validMin: 0,
        validMax: 10000
      });
    }
    for (const parameterId of [
      "radius", "topLeftPercent", "topRightPercent",
      "bottomRightPercent", "bottomLeftPercent"
    ]) {
      expect(schema.parameters.find(({ id }) => id === parameterId)).toMatchObject({
        sliderMin: 0,
        sliderMax: 100,
        validMin: 0,
        validMax: 100
      });
    }
    expect(schema.group).toBe("分离参数");
    expect(schema.styleGroup).toBe("样式");
    expect(schema.parameters.find(({ id }) => id === "fillEnabled")).toMatchObject({
      type: "checkbox", defaultValue: 1
    });
    expect(schema.parameters.find(({ id }) => id === "fillColor")).toMatchObject({
      type: "color", defaultValue: [1, 1, 1, 1]
    });
    expect(schema.parameters.find(({ id }) => id === "strokeEnabled")).toMatchObject({
      type: "checkbox", defaultValue: 0
    });
    expect(schema.parameters.find(({ id }) => id === "strokeColor")).toMatchObject({
      type: "color", defaultValue: [0, 0, 0, 1]
    });
    expect(schema.parameters.find(({ id }) => id === "strokeWidth")).toMatchObject({
      type: "slider", defaultValue: 5,
      sliderMin: 0, sliderMax: 100,
      validMin: 0, validMax: 1000
    });
    expect((await readdir(root)).filter(file => file.endsWith(".ffx")).sort()).toEqual([
      "circle-zh-CN.ffx",
      "rounded-rectangle-zh-CN.ffx",
      "star-zh-CN.ffx",
      "triangle-zh-CN.ffx"
    ]);
    const bytes = await readFile(`${root}/${template.file}`);
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(template.sha256);
  });

  it("encodes width and height with 0–4000 dragging and a 0–10000 typed-input range", async () => {
    const bytes = await readFile(`${root}/rounded-rectangle-zh-CN.ffx`);
    const rootChunk = parseRifx(bytes)[0];
    const definitions = findChunk(rootChunk, "parT");
    const parameterDefinitions = definitions.children.filter(child => child.tag === "pard");

    for (const definition of parameterDefinitions.slice(1, 3)) {
      expect(definition.data.readFloatBE(104)).toBe(0);
      expect(definition.data.readFloatBE(108)).toBe(10000);
      expect(definition.data.readFloatBE(112)).toBe(0);
      expect(definition.data.readFloatBE(116)).toBe(4000);
      expect(definition.data.readFloatBE(120)).toBe(500);
    }

    const values = findChunk(rootChunk, "tdgp");
    const parameterStreams = values.children.filter(child => child.type === "tdbs");
    for (const stream of parameterStreams.slice(1, 3)) {
      expect(stream.children.find(child => child.tag === "tdum").data.readDoubleBE(0)).toBe(0);
      expect(stream.children.find(child => child.tag === "tduM").data.readDoubleBE(0)).toBe(4000);
    }
  });

  it("encodes the v7 style controls with AE checkbox, color, and slider parameter kinds", async () => {
    const bytes = await readFile(`${root}/rounded-rectangle-zh-CN.ffx`);
    const rootChunk = parseRifx(bytes)[0];
    const definitions = findChunk(rootChunk, "parT");
    const parameterDefinitions = definitions.children.filter(child => child.tag === "pard");

    expect(parameterDefinitions).toHaveLength(18);
    expect(parameterDefinitions[12].data.readUInt32BE(12)).toBe(4);
    expect(parameterDefinitions[13].data.readUInt32BE(12)).toBe(5);
    expect(parameterDefinitions[14].data.readUInt32BE(12)).toBe(4);
    expect(parameterDefinitions[15].data.readUInt32BE(12)).toBe(5);
    expect(parameterDefinitions[16].data.readUInt32BE(12)).toBe(10);
    expect(parameterDefinitions[16].data.readFloatBE(108)).toBe(1000);
    expect(parameterDefinitions[16].data.readFloatBE(116)).toBe(100);
    const streams = findChunk(rootChunk, "tdgp").children.filter(child => child.type === "tdbs");
    expect(streams[16].children.find(child => child.tag === "tduM").data.readDoubleBE(0)).toBe(100);
  });
});

describe("circle pseudo-effect asset", () => {
  it("ships a separate six-parameter template with stable semantic indices", async () => {
    const schema = JSON.parse(await readFile("assets/pseudo-effects/circle/v3/schema.json", "utf8"));
    expect(schema).toMatchObject({
      templateId: "shape.circle/v3/zh-CN",
      matchName: "Pseudo/NYA_Circle_v3_zhCN",
      displayName: "Nya 圆形",
      styleGroup: "样式",
      marker: "__NYA_CIRCLE_V3__"
    });
    expect(schema.parameters).toEqual([
      { id: "radius", label: "半径", type: "slider", defaultValue: 250, sliderMin: 0, sliderMax: 3000, validMin: 0, validMax: 5000 },
      { id: "fillEnabled", label: "启用填充", type: "checkbox", defaultValue: 1 },
      { id: "fillColor", label: "填充颜色", type: "color", defaultValue: [1, 1, 1, 1] },
      { id: "strokeEnabled", label: "启用描边", type: "checkbox", defaultValue: 0 },
      { id: "strokeColor", label: "描边颜色", type: "color", defaultValue: [0, 0, 0, 1] },
      { id: "strokeWidth", label: "描边宽度", type: "slider", defaultValue: 5, sliderMin: 0, sliderMax: 100, validMin: 0, validMax: 1000 }
    ]);

    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const template = catalog.templates[schema.templateId];
    expect(template).toMatchObject({
      file: "circle-zh-CN.ffx",
      matchName: schema.matchName,
      marker: { index: 8, name: schema.marker },
      parameters: { radius: 1, fillEnabled: 3, fillColor: 4, strokeEnabled: 5, strokeColor: 6, strokeWidth: 7 }
    });
    const bytes = await readFile(`${root}/${template.file}`);
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(template.sha256);
  });

  it("encodes the radius drag/input bounds and the style control kinds", async () => {
    const bytes = await readFile(`${root}/circle-zh-CN.ffx`);
    const rootChunk = parseRifx(bytes)[0];
    const definitions = findChunk(rootChunk, "parT").children.filter(child => child.tag === "pard");
    expect(definitions).toHaveLength(9);
    const radius = definitions[1].data;
    expect(radius.readUInt32BE(12)).toBe(10);
    expect(radius.readDoubleBE(56)).toBe(250);
    expect([104, 108, 112, 116, 120].map(offset => radius.readFloatBE(offset))).toEqual([
      0, 5000, 0, 3000, 250
    ]);
    expect([3, 4, 5, 6, 7].map(index => definitions[index].data.readUInt32BE(12))).toEqual([
      4, 5, 4, 5, 10
    ]);
    expect(definitions[7].data.readFloatBE(108)).toBe(1000);
    expect(definitions[7].data.readFloatBE(116)).toBe(100);
    const streams = findChunk(rootChunk, "tdgp").children.filter(child => child.type === "tdbs");
    expect(streams[1].children.find(child => child.tag === "tduM").data.readDoubleBE(0)).toBe(3000);
    expect(streams[7].children.find(child => child.tag === "tduM").data.readDoubleBE(0)).toBe(100);
  });
});

const sharedPolygonStyle = [
  { id: "fillEnabled", label: "启用填充", type: "checkbox", defaultValue: 1 },
  { id: "fillColor", label: "填充颜色", type: "color", defaultValue: [1, 1, 1, 1] },
  { id: "strokeEnabled", label: "启用描边", type: "checkbox", defaultValue: 0 },
  { id: "strokeColor", label: "描边颜色", type: "color", defaultValue: [0, 0, 0, 1] },
  { id: "strokeWidth", label: "描边宽度", type: "slider", defaultValue: 5, sliderMin: 0, sliderMax: 100, validMin: 0, validMax: 1000 }
];

describe.each([
  {
    shape: "triangle", version: 1, displayName: "Nya 三角形",
    matchName: "Pseudo/NYA_Triangle_v1_zhCN", marker: "__NYA_TRIANGLE_V1__",
    styleIndex: 5, markerIndex: 11, definitionCount: 12,
    geometry: [
      { id: "points", label: "点（边数）", type: "slider", defaultValue: 3, sliderMin: 3, sliderMax: 20, validMin: 3, validMax: 100, precision: 0 },
      { id: "rotation", label: "旋转", type: "angle", defaultValue: 0 },
      { id: "outerRadius", label: "外半径", type: "slider", defaultValue: 250, sliderMin: 0, sliderMax: 3000, validMin: 0, validMax: 5000 },
      { id: "outerRoundness", label: "外圆度", type: "percent", defaultValue: 0, sliderMin: 0, sliderMax: 100, validMin: 0, validMax: 100 }
    ],
    indices: {
      points: 1, rotation: 2, outerRadius: 3, outerRoundness: 4,
      fillEnabled: 6, fillColor: 7, strokeEnabled: 8, strokeColor: 9, strokeWidth: 10
    }
  },
  {
    shape: "star", version: 2, displayName: "Nya 星形",
    matchName: "Pseudo/NYA_Star_v2_zhCN", marker: "__NYA_STAR_V2__",
    styleIndex: 7, markerIndex: 13, definitionCount: 14,
    geometry: [
      { id: "points", label: "角数", type: "slider", defaultValue: 5, sliderMin: 3, sliderMax: 20, validMin: 3, validMax: 100, precision: 0 },
      { id: "outerRadius", label: "外半径", type: "slider", defaultValue: 250, sliderMin: 0, sliderMax: 3000, validMin: 0, validMax: 5000 },
      { id: "innerRadius", label: "内半径", type: "slider", defaultValue: 125, sliderMin: 0, sliderMax: 3000, validMin: 0, validMax: 5000 },
      { id: "rotation", label: "旋转", type: "angle", defaultValue: 0 },
      { id: "outerRoundness", label: "外圆角", type: "percent", defaultValue: 0, sliderMin: 0, sliderMax: 100, validMin: 0, validMax: 100 },
      { id: "innerRoundness", label: "内圆角", type: "percent", defaultValue: 0, sliderMin: 0, sliderMax: 100, validMin: 0, validMax: 100 }
    ],
    indices: {
      points: 1, outerRadius: 2, innerRadius: 3, rotation: 4, outerRoundness: 5, innerRoundness: 6,
      fillEnabled: 8, fillColor: 9, strokeEnabled: 10, strokeColor: 11, strokeWidth: 12
    }
  }
])("$shape pseudo-effect asset", (contract) => {
  const templateId = `shape.${contract.shape}/v${contract.version}/zh-CN`;

  async function readTemplate() {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const template = catalog.templates[templateId];
    expect(template, `Missing ${templateId}`).toBeDefined();
    const bytes = await readFile(`${root}/${template.file}`);
    const chunk = parseRifx(bytes)[0];
    return {
      template, bytes,
      definitions: findChunk(chunk, "parT").children.filter(child => child.tag === "pard"),
      streams: findChunk(chunk, "tdgp").children.filter(child => child.type === "tdbs"),
      definitionNames: findChunk(chunk, "parT").children.filter(child => child.tag === "tdmn")
        .map(child => child.data.toString("ascii").replace(/\0.*$/, "")),
      streamNames: findChunk(chunk, "tdgp").children.filter(child => child.tag === "tdmn")
        .map(child => child.data.toString("ascii").replace(/\0.*$/, ""))
    };
  }

  it("ships the confirmed independent identity and ordered parameter contract", async () => {
    const { template, bytes, definitions, streams, definitionNames, streamNames } = await readTemplate();
    const schema = JSON.parse(await readFile(`assets/pseudo-effects/${contract.shape}/v${contract.version}/schema.json`, "utf8"));
    expect(schema).toEqual({
      templateId, matchName: contract.matchName, displayName: contract.displayName,
      styleGroup: "样式", marker: contract.marker,
      parameters: [...contract.geometry, ...sharedPolygonStyle]
    });
    expect(template).toMatchObject({
      file: `${contract.shape}-zh-CN.ffx`, matchName: contract.matchName,
      marker: { index: contract.markerIndex, name: contract.marker }, parameters: contract.indices
    });
    expect(definitions).toHaveLength(contract.definitionCount);
    expect(streams).toHaveLength(contract.definitionCount);
    const expectedNames = Array.from({ length: contract.definitionCount }, (_, index) =>
      `${contract.matchName}-${String(index).padStart(4, "0")}`);
    expect(definitionNames).toEqual(expectedNames);
    expect(streamNames).toEqual([...expectedNames, "ADBE Group End"]);
    expect(definitions[contract.styleIndex].data.readUInt32BE(12)).toBe(13);
    expect(definitions[contract.markerIndex].data.readUInt32BE(12)).toBe(14);
    expect(iconv.decode(definitions[contract.styleIndex].data.subarray(16, 48), "gbk").replace(/\0.*$/, ""))
      .toBe("样式");
    expect(iconv.decode(definitions[contract.markerIndex].data.subarray(16, 48), "gbk").replace(/\0.*$/, ""))
      .toBe(contract.marker);
    for (const parameter of [...contract.geometry, ...sharedPolygonStyle]) {
      const index = contract.indices[parameter.id];
      expect(iconv.decode(definitions[index].data.subarray(16, 48), "gbk").replace(/\0.*$/, ""))
        .toBe(parameter.label);
      expect(iconv.decode(streams[index].children.find(child => child.tag === "tdsn").data, "gbk").replace(/\0.*$/, ""))
        .toBe(parameter.label);
    }
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(template.sha256);
  });

  it("encodes distinct typed and drag limits, integer points and percentage roundness", async () => {
    const { definitions, streams } = await readTemplate();
    for (const parameter of contract.geometry.filter(parameter => parameter.type !== "angle")) {
      const index = contract.indices[parameter.id];
      const data = definitions[index].data;
      expect(data.readUInt32BE(12), parameter.id).toBe(10);
      expect(data.readDoubleBE(56), parameter.id).toBe(parameter.defaultValue);
      expect([104, 108, 112, 116, 120].map(offset => data.readFloatBE(offset)), parameter.id)
        .toEqual([parameter.validMin, parameter.validMax, parameter.sliderMin, parameter.sliderMax, parameter.defaultValue]);
      expect(data.readInt16BE(124), parameter.id).toBe(parameter.id === "points" ? 0 : 2);
      expect(data.readUInt16BE(126), parameter.id).toBe(parameter.type === "percent" ? 1 : 0);
      expect(streams[index].children.find(child => child.tag === "cdat").data.readDoubleBE(0), parameter.id)
        .toBe(parameter.defaultValue);
      expect(streams[index].children.find(child => child.tag === "tdum").data.readDoubleBE(0), parameter.id)
        .toBe(parameter.sliderMin);
      expect(streams[index].children.find(child => child.tag === "tduM").data.readDoubleBE(0), parameter.id)
        .toBe(parameter.sliderMax);
    }
  });

  it("encodes rotation as a native Angle without inherited scalar input bounds", async () => {
    const { definitions, streams } = await readTemplate();
    const index = contract.indices.rotation;
    const angle = definitions[index].data;
    expect(angle.readUInt32BE(12)).toBe(3);
    expect(angle.readInt32BE(56)).toBe(0);
    expect([...angle.subarray(60)]).toEqual(new Array(angle.length - 60).fill(0));
    expect(streams[index].children.find(child => child.tag === "cdat").data.readDoubleBE(0)).toBe(0);
  });

  it("keeps the five style kinds and checkbox defaults at their fixed indices", async () => {
    const { definitions, streams } = await readTemplate();
    expect(sharedPolygonStyle.map(parameter => definitions[contract.indices[parameter.id]].data.readUInt32BE(12)))
      .toEqual([4, 5, 4, 5, 10]);
    expect(streams[contract.indices.fillEnabled].children.find(child => child.tag === "cdat").data.readDoubleBE(0)).toBe(1);
    expect(streams[contract.indices.strokeEnabled].children.find(child => child.tag === "cdat").data.readDoubleBE(0)).toBe(0);
    expect(definitions[contract.indices.strokeWidth].data.readInt16BE(124)).toBe(2);
  });

  it("encodes opaque white fill and black stroke in AE native ARGB channel order", async () => {
    const { streams } = await readTemplate();
    for (const [parameterId, expectedChannels] of [
      ["fillColor", [255, 255, 255, 255]],
      ["strokeColor", [255, 0, 0, 0]]
    ]) {
      const color = streams[contract.indices[parameterId]].children.find(child => child.tag === "cdat").data;
      expect([0, 8, 16, 24].map(offset => color.readDoubleBE(offset)), parameterId).toEqual(expectedChannels);
    }
  });

  it("preserves checkbox value and single-byte reset defaults in the native definition", async () => {
    const { definitions } = await readTemplate();
    for (const [parameterId, expectedValue] of [["fillEnabled", 1], ["strokeEnabled", 0]]) {
      const checkbox = definitions[contract.indices[parameterId]].data;
      expect(checkbox.readUInt32BE(56), parameterId).toBe(expectedValue);
      expect(checkbox.readUInt8(60), parameterId).toBe(expectedValue);
    }
  });

  it("resets registered native color definitions to white fill and opaque black stroke", async () => {
    const { definitions } = await readTemplate();
    for (const [parameterId, expectedChannels] of [
      ["fillColor", [255, 255, 255, 255]],
      ["strokeColor", [255, 0, 0, 0]]
    ]) {
      const color = definitions[contract.indices[parameterId]].data;
      expect([...color.subarray(56, 60)], `${parameterId} value`).toEqual(expectedChannels);
      expect([...color.subarray(60, 64)], `${parameterId} default`).toEqual(expectedChannels);
    }
  });
});

describe("shape asset generator layout validation", () => {
  it("rejects an unknown layout instead of reusing the valid circle contract", async () => {
    const layoutParameters = await readLayoutFunction();
    const schema = JSON.parse(await readFile("assets/pseudo-effects/circle/v3/schema.json", "utf8"));
    expect(() => layoutParameters(schema, "unknown")).toThrow("Unsupported pseudo-effect layout");
  });

  it.each([
    ["rectangle", "rounded-rectangle/v7"],
    ["circle", "circle/v3"],
    ["triangle", "triangle/v1"],
    ["star", "star/v2"]
  ])("requires the shared stroke contract before building the %s layout", async (layout, source) => {
    const layoutParameters = await readLayoutFunction();
    expect(await readdir(`assets/pseudo-effects/${source.split("/")[0]}`)).toContain(source.split("/")[1]);
    const schema = JSON.parse(await readFile(`assets/pseudo-effects/${source}/schema.json`, "utf8"));
    schema.parameters.find(parameter => parameter.id === "strokeWidth").sliderMax = 500;
    expect(() => layoutParameters(schema, layout)).toThrow("Invalid shared shape stroke width");
  });
});

describe("shared shape stroke width", () => {
  it("encodes the same default, drag bounds and typed-input bounds in every shipped shape", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    for (const [templateId, template] of Object.entries(catalog.templates)) {
      const bytes = await readFile(`${root}/${template.file}`);
      const chunk = parseRifx(bytes)[0];
      const index = template.parameters.strokeWidth;
      const definition = findChunk(chunk, "parT").children.filter(child => child.tag === "pard")[index].data;
      const stream = findChunk(chunk, "tdgp").children.filter(child => child.type === "tdbs")[index];
      expect(definition.readUInt32BE(12), templateId).toBe(10);
      expect(definition.readDoubleBE(56), templateId).toBe(5);
      expect([104, 108, 112, 116, 120].map(offset => definition.readFloatBE(offset)), templateId)
        .toEqual([0, 1000, 0, 100, 5]);
      expect(stream.children.find(child => child.tag === "tdum").data.readDoubleBE(0), templateId).toBe(0);
      expect(stream.children.find(child => child.tag === "tduM").data.readDoubleBE(0), templateId).toBe(100);
    }
  });

  it("accepts the approved rectangle specification without rewriting it", async () => {
    const { validateShapeStrokeWidth } = await import("../scripts/shape-pseudo-effect-contract.mjs");
    const schema = JSON.parse(await readFile("assets/pseudo-effects/rounded-rectangle/v7/schema.json", "utf8"));
    const before = JSON.stringify(schema);
    expect(() => validateShapeStrokeWidth(schema)).not.toThrow();
    expect(JSON.stringify(schema)).toBe(before);
  });

  it.each([
    ["wrong drag limit", { sliderMax: 500 }],
    ["wrong input limit", { validMax: 500 }],
    ["wrong default", { defaultValue: 10 }],
    ["wrong type", { type: "percent" }],
    ["negative drag minimum", { sliderMin: -1 }],
    ["negative input minimum", { validMin: -1 }]
  ])("rejects %s instead of silently changing a shape specification", async (_label, patch) => {
    const { validateShapeStrokeWidth } = await import("../scripts/shape-pseudo-effect-contract.mjs");
    const schema = JSON.parse(await readFile("assets/pseudo-effects/rounded-rectangle/v7/schema.json", "utf8"));
    Object.assign(schema.parameters.find(parameter => parameter.id === "strokeWidth"), patch);
    expect(() => validateShapeStrokeWidth(schema)).toThrow("Invalid shared shape stroke width");
  });

  it("rejects missing or duplicate stroke controls", async () => {
    const { validateShapeStrokeWidth } = await import("../scripts/shape-pseudo-effect-contract.mjs");
    const schema = JSON.parse(await readFile("assets/pseudo-effects/rounded-rectangle/v7/schema.json", "utf8"));
    const stroke = schema.parameters.find(parameter => parameter.id === "strokeWidth");
    expect(() => validateShapeStrokeWidth({ ...schema, parameters: [] }))
      .toThrow("Invalid shared shape stroke width");
    expect(() => validateShapeStrokeWidth({ ...schema, parameters: [stroke, stroke] }))
      .toThrow("Invalid shared shape stroke width");
  });
});

describe("pseudo-effect definition compatibility", () => {
  it.each([
    ["Pseudo/NYA_RRect_v7_zhCN", "D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9"],
    ["Pseudo/NYA_Circle_v1_zhCN", "D6E69D121E41974187EE1741D6FB5D25F90C343676BBF79A9F15FBA1442E103A"],
    ["Pseudo/NYA_Circle_v2_zhCN", "C0BCC6FA28CAEB11B8CC4A8D686C776CEA1ED243F2A71406F86FAAB820EB4E48"],
    ["Pseudo/NYA_Circle_v3_zhCN", "0B3F38341544AC1B13CF0D5E2F87CE734555EC388CE334C7F22BA8DE7E99E02E"],
    ["Pseudo/NYA_Triangle_v1_zhCN", "4F616CDF3BCA836F2887FE3866975658D7D0F9F06A2D57F1A5B85B90CEBC0476"]
  ])("does not replace an AE-loaded %s definition with different bytes", async (matchName, publishedHash) => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const current = Object.values(catalog.templates).find(template => template.matchName === matchName);
    if (!current) return;
    const bytes = await readFile(`${root}/${current.file}`);
    const actualHash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    expect(actualHash).toBe(publishedHash);
  });
});
