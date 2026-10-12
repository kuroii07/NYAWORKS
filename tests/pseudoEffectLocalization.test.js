import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { REQUIRED_DIST_FILES } from "../scripts/dist-contract.mjs";

const root = "public/host/pseudo-effects";
const shapes = [
  { source: "rounded-rectangle/v7", id: "shape.roundedRectangle", version: 7, file: "rounded-rectangle", name: "Nya Rounded Rectangle", identity: "RRect", style: 11, group: 5 },
  { source: "circle/v3", id: "shape.circle", version: 3, file: "circle", name: "Nya Circle", identity: "Circle", style: 2 },
  { source: "triangle/v1", id: "shape.triangle", version: 1, file: "triangle", name: "Nya Triangle", identity: "Triangle", style: 5 },
  { source: "star/v2", id: "shape.star", version: 2, file: "star", name: "Nya Star", identity: "Star", style: 7 }
];
const labels = {
  width: "Width", height: "Height", radius: "Radius", separate: "Separate Corners",
  topLeftPercent: "Top Left", topRightPercent: "Top Right", bottomRightPercent: "Bottom Right", bottomLeftPercent: "Bottom Left",
  fillEnabled: "Enable Fill", fillColor: "Fill Color", strokeEnabled: "Enable Stroke", strokeColor: "Stroke Color", strokeWidth: "Stroke Width",
  points: "Points", rotation: "Rotation", outerRadius: "Outer Radius", innerRadius: "Inner Radius", outerRoundness: "Outer Roundness", innerRoundness: "Inner Roundness"
};
// Every visible label is namespaced, including groups: bare AE terms were
// displayed in Chinese in the English candidate on the user's Chinese AE.
const englishLabel = label => `Nya ${label}`;
const traditionalLabels = {
  width: "寬度", height: "高度", radius: "半徑", separate: "分離圓角",
  topLeftPercent: "左上角", topRightPercent: "右上角", bottomRightPercent: "右下角", bottomLeftPercent: "左下角",
  fillEnabled: "啟用填色", fillColor: "填色顏色", strokeEnabled: "啟用描邊", strokeColor: "描邊顏色", strokeWidth: "描邊寬度",
  points: "點數", rotation: "旋轉", outerRadius: "外半徑", innerRadius: "內半徑", outerRoundness: "外圓度", innerRoundness: "內圓度"
};

function parse(bytes, start = 0, end = bytes.length) {
  const nodes = [];
  for (let at = start; at < end;) {
    expect(at + 8).toBeLessThanOrEqual(end);
    const tag = bytes.toString("ascii", at, at + 4);
    const size = bytes.readUInt32BE(at + 4);
    expect(at + 8 + size).toBeLessThanOrEqual(end);
    const node = { tag };
    if (tag === "RIFX" || tag === "LIST") {
      node.type = bytes.toString("ascii", at + 8, at + 12);
      node.children = parse(bytes, at + 12, at + 8 + size);
    } else node.data = bytes.subarray(at + 8, at + 8 + size);
    nodes.push(node);
    at += 8 + size + size % 2;
  }
  return nodes;
}
function find(node, type) {
  if (node.type === type) return node;
  for (const child of node.children || []) {
    const found = find(child, type);
    if (found) return found;
  }
  return null;
}
const decoded = data => iconv.decode(data, "gbk").replace(/\0.*$/, "");
const hash = bytes => createHash("sha256").update(bytes).digest("hex").toUpperCase();

describe("English pseudo-effect candidates", () => {
  it.each(shapes)("ships an independent $file identity with the frozen semantic contract", async shape => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const legacy = catalog.templates[`${shape.id}/v${shape.version}/zh-CN`];
    const id = `${shape.id}/v${shape.version}/en`;
    const template = catalog.templates[id];
    expect(template, id).toBeDefined();
    const schema = JSON.parse(await readFile(`assets/pseudo-effects/${shape.source}/en/schema.json`, "utf8"));
    const chinese = JSON.parse(await readFile(`assets/pseudo-effects/${shape.source}/schema.json`, "utf8"));
    expect(schema).toMatchObject({ templateId: id, matchName: `Pseudo/NYA_${shape.identity}_v${shape.version}_en_r2`, definitionRevision: 2, displayName: shape.name, marker: chinese.marker, styleGroup: englishLabel("Style") });
    expect(schema.parameters.map(({ label, ...contract }) => contract))
      .toEqual(chinese.parameters.map(({ label, ...contract }) => contract));
    expect(schema.parameters.map(parameter => parameter.label)).toEqual(schema.parameters.map(parameter =>
      englishLabel(shape.file === "rounded-rectangle" && parameter.id === "radius" ? "Corner Radius" : labels[parameter.id])));
    expect(template).toMatchObject({
      effectId: shape.id, shape: shape.file, schemaVersion: shape.version, definitionRevision: 2, locale: "en",
      file: `en/${shape.file}.ffx`, matchName: schema.matchName, displayName: shape.name,
      marker: legacy.marker, parameters: legacy.parameters, parameterDefinitions: schema.parameters,
      validation: { status: "candidate", realAE: "pending", platforms: ["Windows"], targetAE: "2022–2026+" }
    });
    expect(template.matchName).not.toBe(legacy.matchName);
    expect(REQUIRED_DIST_FILES).toContain(`dist/host/pseudo-effects/${template.file}`);

    const bytes = await readFile(`${root}/${template.file}`);
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
    expect(bytes.readUInt32BE(4) + 8).toBe(bytes.length);
    expect(hash(bytes)).toBe(template.sha256);
    expect(bytes.includes(Buffer.from(schema.matchName))).toBe(true);
    const chunk = parse(bytes)[0];
    const definitions = find(chunk, "parT").children.filter(child => child.tag === "pard");
    const streams = find(chunk, "tdgp").children.filter(child => child.type === "tdbs");
    const count = legacy.marker.index + 1;
    expect(definitions).toHaveLength(count);
    expect(streams).toHaveLength(count);
    const names = Array.from({ length: count }, (_, index) => `${schema.matchName}-${String(index).padStart(4, "0")}`);
    expect(find(chunk, "parT").children.filter(child => child.tag === "tdmn").map(child => decoded(child.data))).toEqual(names);
    expect(find(chunk, "tdgp").children.filter(child => child.tag === "tdmn").map(child => decoded(child.data))).toEqual([...names, "ADBE Group End"]);
    expect(decoded(find(chunk, "tdgp").children.find(child => child.tag === "tdsn").data)).toBe(shape.name);
    expect(definitions[shape.style].data.readUInt32BE(12)).toBe(13);
    expect(decoded(definitions[shape.style].data.subarray(16, 48))).toBe(englishLabel("Style"));
    expect(decoded(streams[shape.style].children.find(child => child.tag === "tdsn").data)).toBe(englishLabel("Style"));
    if (shape.group) {
      expect(decoded(definitions[shape.group].data.subarray(16, 48))).toBe(englishLabel("Corner Controls"));
      expect(decoded(streams[shape.group].children.find(child => child.tag === "tdsn").data)).toBe(englishLabel("Corner Controls"));
    }
    expect(definitions[legacy.marker.index].data.readUInt32BE(12)).toBe(14);
    expect(decoded(definitions[legacy.marker.index].data.subarray(16, 48))).toBe(chinese.marker);
    for (const parameter of schema.parameters) {
      const index = legacy.parameters[parameter.id];
      const definition = definitions[index].data;
      const stream = streams[index];
      expect(decoded(definition.subarray(16, 48))).toBe(parameter.label);
      expect(decoded(stream.children.find(child => child.tag === "tdsn").data)).toBe(parameter.label);
      expect(definition.readUInt32BE(12)).toBe({ slider: 10, percent: 10, angle: 3, checkbox: 4, color: 5 }[parameter.type]);
      const value = stream.children.find(child => child.tag === "cdat").data;
      if (parameter.type === "color") {
        const argb = [parameter.defaultValue[3], ...parameter.defaultValue.slice(0, 3)];
        expect([...definition.subarray(56, 60)]).toEqual(argb.map(channel => channel * 255));
        expect([...definition.subarray(60, 64)]).toEqual(argb.map(channel => channel * 255));
        expect(argb.map((_, channel) => value.readDoubleBE(channel * 8))).toEqual(argb.map(channel => channel * 255));
      } else {
        expect(value.readDoubleBE(0)).toBe(parameter.defaultValue);
        if (parameter.type === "checkbox") {
          expect(definition.readUInt32BE(56)).toBe(parameter.defaultValue);
          expect(definition.readUInt8(60)).toBe(parameter.defaultValue);
        } else if (parameter.type === "angle") expect(definition.readInt32BE(56)).toBe(parameter.defaultValue);
        else {
          expect(definition.readDoubleBE(56)).toBe(parameter.defaultValue);
          expect([104, 108, 112, 116, 120].map(offset => definition.readFloatBE(offset))).toEqual([
            parameter.validMin, parameter.validMax, parameter.sliderMin, parameter.sliderMax, parameter.defaultValue
          ]);
          expect(definition.readInt16BE(124)).toBe(parameter.precision ?? 2);
          expect(definition.readUInt16BE(126)).toBe(parameter.type === "percent" ? 1 : 0);
          expect(stream.children.find(child => child.tag === "tdum").data.readDoubleBE(0)).toBe(parameter.sliderMin);
          expect(stream.children.find(child => child.tag === "tduM").data.readDoubleBE(0)).toBe(parameter.sliderMax);
        }
      }
    }
  });

  it("regenerates only English, preserving Chinese entries and all legacy bytes", async () => {
    const before = await readFile(`${root}/catalog.json`, "utf8");
    const catalog = JSON.parse(before);
    expect(Object.keys(catalog.templates).filter(id => id.endsWith("/en"))).toHaveLength(4);
    const legacy = await Promise.all(shapes.map(shape => readFile(`${root}/${shape.file}-zh-CN.ffx`)));
    execFileSync(process.execPath, ["scripts/build-shape-pseudo-effects.mjs", "--locale=en"], { stdio: "pipe" });
    // Git may check out CRLF on Windows; the generator writes LF.
    expect((await readFile(`${root}/catalog.json`, "utf8")).replace(/\r\n/g, "\n")).toBe(before.replace(/\r\n/g, "\n"));
    for (const [index, shape] of shapes.entries()) expect(await readFile(`${root}/${shape.file}-zh-CN.ffx`)).toEqual(legacy[index]);
  });
});

describe("Traditional Chinese shape candidates", () => {
  it.each(shapes)("authors the full $file contract independently of English and Chinese", async shape => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const template = catalog.templates[`${shape.id}/v${shape.version}/zh-TW`];
    expect(template).toBeDefined();
    const schema = JSON.parse(await readFile(`assets/pseudo-effects/${shape.source}/zh-TW/schema.json`, "utf8"));
    const chinese = JSON.parse(await readFile(`assets/pseudo-effects/${shape.source}/schema.json`, "utf8"));
    expect(template).toMatchObject({ locale: "zh-TW", matchName: `Pseudo/NYA_${shape.identity}_v${shape.version}_zhTW`, file: `zh-TW/${shape.file}.ffx`, parameterDefinitions: schema.parameters });
    expect(schema.parameters.map(({ label, ...contract }) => contract)).toEqual(chinese.parameters.map(({ label, ...contract }) => contract));
    expect(schema.parameters.map(parameter => parameter.label)).toEqual(schema.parameters.map(parameter =>
      `Nya ${shape.file === "rounded-rectangle" && parameter.id === "radius" ? "圓角值" : traditionalLabels[parameter.id]}`));
    const bytes = await readFile(`${root}/${template.file}`);
    expect(hash(bytes)).toBe(template.sha256);
    const chunk = parse(bytes)[0];
    const definitions = find(chunk, "parT").children.filter(child => child.tag === "pard");
    const streams = find(chunk, "tdgp").children.filter(child => child.type === "tdbs");
    for (const parameter of schema.parameters) {
      const index = template.parameters[parameter.id];
      expect(decoded(definitions[index].data.subarray(16, 48))).toBe(parameter.label);
      expect(decoded(streams[index].children.find(child => child.tag === "tdsn").data)).toBe(parameter.label);
      expect(definitions[index].data.readUInt32BE(12)).toBe({ slider: 10, percent: 10, angle: 3, checkbox: 4, color: 5 }[parameter.type]);
    }
    expect(decoded(definitions[shape.style].data.subarray(16, 48))).toBe("Nya 樣式");
    if (shape.group) expect(decoded(definitions[shape.group].data.subarray(16, 48))).toBe("Nya 圓角控制");
    expect(template.parameters).toEqual(catalog.templates[chinese.templateId].parameters);
    expect(template.marker).toEqual(catalog.templates[chinese.templateId].marker);
    expect(REQUIRED_DIST_FILES).toContain(`dist/host/pseudo-effects/${template.file}`);
  });

  it("rebuilds Traditional Chinese without rewriting any accepted English or Chinese preset", async () => {
    const before = await readFile(`${root}/catalog.json`, "utf8");
    const files = shapes.flatMap(shape => [`${root}/en/${shape.file}.ffx`, `${root}/${shape.file}-zh-CN.ffx`]);
    const snapshots = await Promise.all(files.map(file => readFile(file)));
    execFileSync(process.execPath, ["scripts/build-shape-pseudo-effects.mjs", "--locale=zh-TW"], { stdio: "pipe" });
    expect((await readFile(`${root}/catalog.json`, "utf8")).replace(/\r\n/g, "\n")).toBe(before.replace(/\r\n/g, "\n"));
    for (const [index, file] of files.entries()) expect(await readFile(file)).toEqual(snapshots[index]);
  });

  it("rejects unrepresentable parameter text before writing any assets or catalog", async () => {
    const file = "assets/pseudo-effects/circle/v3/zh-TW/schema.json";
    const original = await readFile(file, "utf8");
    const catalog = await readFile(`${root}/catalog.json`, "utf8");
    const asset = await readFile(`${root}/zh-TW/rounded-rectangle.ffx`);
    try {
      const schema = JSON.parse(original);
      schema.parameters[0].label = "Nya 한국어";
      await writeFile(file, JSON.stringify(schema));
      expect(() => execFileSync(process.execPath, ["scripts/build-shape-pseudo-effects.mjs", "--locale=zh-TW"], { stdio: "pipe" })).toThrow(/cannot be represented in GBK/);
      expect(await readFile(`${root}/catalog.json`, "utf8")).toBe(catalog);
      expect(await readFile(`${root}/zh-TW/rounded-rectangle.ffx`)).toEqual(asset);
    } finally { await writeFile(file, original); }
  });
});

describe("Explicit Japanese/Korean English-controls compatibility", () => {
  it.each(["ja", "ko"])("maps all four %s shapes to the accepted English definitions", async language => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const names = {
      ja: ["Nya 角丸長方形", "Nya 円", "Nya 三角形", "Nya 星形"],
      ko: ["Nya 둥근 사각형", "Nya 원", "Nya 삼각형", "Nya 별"]
    };
    for (const [index, shape] of shapes.entries()) {
      const sourceTemplateId = `${shape.id}/v${shape.version}/en`;
      const english = catalog.templates[sourceTemplateId];
      const entry = catalog.templates[`${shape.id}/v${shape.version}/${language}`];
      expect(entry).toMatchObject({ locale: language, displayName: names[language][index], controlLocale: "en", sourceTemplateId,
        file: english.file, matchName: english.matchName, sha256: english.sha256,
        parameters: english.parameters, parameterDefinitions: english.parameterDefinitions, marker: english.marker });
      expect(hash(await readFile(`${root}/${entry.file}`))).toBe(entry.sha256);
    }
  });
});
