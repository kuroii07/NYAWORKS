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
      "dist/host/pseudo-effects/rounded-rectangle-zh-CN.ffx"
    ]);
  });

  it("ships only the v7 round-rectangle effect with geometry and style controls", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    expect(Object.keys(catalog.templates)).toEqual([id]);
    const template = catalog.templates[id];
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
    expect((await readdir(root)).filter(file => file.endsWith(".ffx"))).toEqual([
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
  });
});
