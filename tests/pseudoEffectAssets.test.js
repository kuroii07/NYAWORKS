import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
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

describe("rounded rectangle pseudo-effect asset", () => {
  it("requires only the approved, version-free preset and its catalog in production builds", () => {
    expect(REQUIRED_DIST_FILES).toContain("dist/host/pseudo-effects/catalog.json");
    expect(REQUIRED_DIST_FILES.filter(file => file.endsWith(".ffx"))).toEqual([
      "dist/host/pseudo-effects/rounded-rectangle-zh-CN.ffx",
      "dist/host/pseudo-effects/circle-zh-CN.ffx"
    ]);
  });

  it("ships the last AE-approved v7 round-rectangle preset unchanged", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const template = catalog.templates[id];
    expect(template.sha256).toBe("D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9");
    expect(Object.keys(catalog.templates)).toEqual(["shape.roundedRectangle/v7/zh-CN", "shape.circle/v3/zh-CN"]);
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
      "rounded-rectangle-zh-CN.ffx"
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
    ["Pseudo/NYA_Circle_v2_zhCN", "C0BCC6FA28CAEB11B8CC4A8D686C776CEA1ED243F2A71406F86FAAB820EB4E48"]
  ])("does not replace an AE-loaded %s definition with different bytes", async (matchName, publishedHash) => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const current = Object.values(catalog.templates).find(template => template.matchName === matchName);
    if (!current) return;
    const bytes = await readFile(`${root}/${current.file}`);
    const actualHash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    expect(actualHash).toBe(publishedHash);
  });
});
