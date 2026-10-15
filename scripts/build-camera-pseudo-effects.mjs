import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import iconv from "iconv-lite";
import { inspectPseudoEffectStructure } from "./pseudo-effect-structure.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "public/host/pseudo-effects");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output-dir" || !args[1])) {
  throw new Error("Usage: build-camera-pseudo-effects.mjs [--output-dir path]");
}
const outputDir = args.length ? path.resolve(args[1]) : sourceDir;
const schema = JSON.parse(fs.readFileSync(path.join(rootDir,
  "assets/pseudo-effects/camera/v3/schema.json"), "utf8"));
const base = fs.readFileSync(path.join(rootDir,
  "assets/pseudo-effects/rounded-rectangle/source/base-scribe.ffx"));
const catalog = JSON.parse(fs.readFileSync(path.join(sourceDir, "catalog.json"), "utf8"));
const localeInfo = {
  "zh-CN": { suffix: "zhCN_r2", encoding: "gbk", file: "camera-zh-CN.ffx" },
  "zh-TW": { suffix: "zhTW_r2", encoding: "gbk", file: "zh-TW/camera.ffx" },
  en: { suffix: "en_r2", encoding: "ascii", file: "en/camera.ffx" },
  ja: { suffix: "ja_r3", encoding: "gb18030", file: "ja/camera.ffx" }
};

function parse(bytes, start = 0, end = bytes.length) {
  const result = [];
  for (let at = start; at < end;) {
    const tag = bytes.toString("ascii", at, at + 4);
    const length = bytes.readUInt32BE(at + 4);
    if (at + 8 + length > end) throw new Error("Invalid FFX chunk boundary");
    const node = { tag };
    if (tag === "RIFX" || tag === "LIST") {
      node.type = bytes.toString("ascii", at + 8, at + 12);
      node.children = parse(bytes, at + 12, at + 8 + length);
    } else node.data = Buffer.from(bytes.subarray(at + 8, at + 8 + length));
    result.push(node);
    at += 8 + length + length % 2;
  }
  return result;
}
function pack(node) {
  const data = node.children
    ? Buffer.concat([Buffer.from(node.type), ...node.children.map(pack)])
    : node.data;
  const header = Buffer.alloc(8);
  header.write(node.tag);
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data, Buffer.alloc(data.length % 2)]);
}
function find(node, type) {
  if (node.type === type) return node;
  for (const child of node.children || []) {
    const match = find(child, type);
    if (match) return match;
  }
  return null;
}
function clone(node) { return parse(pack(node))[0]; }
function encoded(value, encoding) {
  const bytes = iconv.encode(value, encoding);
  if (iconv.decode(bytes, encoding) !== value) {
    throw new Error(`FFX cannot encode ${encoding}: ${value}`);
  }
  return Buffer.concat([bytes, Buffer.alloc(1)]);
}
function fixed(value, size, encoding) {
  const bytes = encoded(value, encoding);
  if (bytes.length > size) throw new Error(`FFX label exceeds ${size} bytes: ${value}`);
  const result = Buffer.alloc(size);
  bytes.copy(result);
  return result;
}
function leaf(tag, data) { return { tag, data }; }
function uint(value) {
  const data = Buffer.alloc(4);
  data.writeUInt32BE(value);
  return data;
}
function text(tag, value, encoding, size) {
  return leaf(tag, size ? fixed(value, size, encoding) : encoded(value, encoding));
}

const expectedGroups = ["target", "transform", "motion", "lens", "focus", "shake"];
const expectedIds = ["target.layer", "position.x", "position.y", "position.z",
  "rotation.x", "rotation.y", "rotation.z", "motion.enabled", "motion.speed",
  "lens.focalLength", "lens.depthOfField", "focus.auto", "focus.distance",
  "shake.strength", "shake.frequency"];
if (JSON.stringify(schema.groups.map(g => g.id)) !== JSON.stringify(expectedGroups) ||
    JSON.stringify(schema.parameters.map(p => p.id)) !== JSON.stringify(expectedIds) ||
    schema.parameters.length !== 15 || schema.schemaVersion !== 3 || schema.marker !== "__NYA_CAMERA_V3__") {
  throw new Error("Camera contract changed without a schema revision");
}
const artifacts = [];
for (const [locale, localeSpec] of Object.entries(localeInfo)) {
  const matchName = `Pseudo/NYA_Camera_v3_${localeSpec.suffix}`;
  const displayName = schema.displayNames[locale];
  const root = parse(base)[0];
  const definitions = find(root, "parT");
  const streams = find(root, "tdgp");
  if (!definitions || !streams) throw new Error("Scribe source format changed");
  const sourceDefinitions = definitions.children.filter(node => node.tag === "pard");
  const sourceStreams = streams.children.filter(node => node.type === "tdbs");
  const parameters = [{ kind: 0, source: 0, label: "" }];
  for (const group of schema.groups) {
    parameters.push({ kind: 13, source: 3, label: group.labels[locale] });
    for (const item of schema.parameters.filter(p => p.group === group.id)) {
      const kind = { layer: 0, slider: 10, angle: 3, checkbox: 4 }[item.type];
      if (kind === undefined) throw new Error(`Unknown camera parameter type: ${item.type}`);
      if (item.type === "slider") {
        const bounds = [item.validMin, item.sliderMin, item.defaultValue,
          item.sliderMax, item.validMax];
        if (!bounds.every(Number.isFinite) || bounds.some((v, i) => i && v < bounds[i - 1])) {
          throw new Error(`Invalid bounds: ${item.id}`);
        }
      }
      parameters.push({ ...item, label: item.labels[locale], kind,
        source: item.type === "layer" ? 0 : 2 });
    }
    parameters.push({ kind: 14, source: 7, label: "" });
  }
  // The marker labels the existing final group's terminator. A seventh end
  // would have no matching start and corrupt the parameter-group structure.
  parameters[parameters.length - 1].label = schema.marker;
  if (parameters.length !== 28) throw new Error("Camera parameter layout changed");
  definitions.children = [leaf("parn", uint(parameters.length))];
  streams.children = [leaf("tdsb", uint(1)), text("tdsn", displayName, localeSpec.encoding)];
  const mapping = {};
  for (const [index, parameter] of parameters.entries()) {
    const name = `${matchName}-${String(index).padStart(4, "0")}`;
    const definition = clone(sourceDefinitions[parameter.source]);
    definition.data.fill(0, 16, 48);
    fixed(parameter.label, 32, localeSpec.encoding).copy(definition.data, 16);
    definition.data.writeUInt32BE(parameter.kind, 12);
    if (parameter.kind === 10) {
      definition.data.fill(0, 56);
      definition.data.writeDoubleBE(parameter.defaultValue, 56);
      definition.data.writeFloatBE(parameter.validMin, 104);
      definition.data.writeFloatBE(parameter.validMax, 108);
      definition.data.writeFloatBE(parameter.sliderMin, 112);
      definition.data.writeFloatBE(parameter.sliderMax, 116);
      definition.data.writeFloatBE(parameter.defaultValue, 120);
      definition.data.writeInt16BE(2, 124);
    } else if (parameter.kind === 3) {
      definition.data.fill(0, 56);
      definition.data.writeInt32BE(parameter.defaultValue, 56);
    } else if (parameter.kind === 4) {
      definition.data.fill(0, 56);
      definition.data.writeUInt32BE(4, 48);
      definition.data.writeUInt32BE(parameter.defaultValue, 56);
      definition.data.writeUInt8(parameter.defaultValue, 60);
    } else if (parameter.id === "target.layer") {
      // Layer Control definition fields from the native preset comparison.
      // Definition type alone does not make its value stream visible.
      definition.data.writeUInt32LE(1, 84);
      definition.data.fill(0, 88, 92);
    }
    definitions.children.push(text("tdmn", name, "ascii", 40), definition);
    if (parameter.kind === 4) definitions.children.push(text("pdnm", "", "ascii"));
    const stream = clone(sourceStreams[parameter.source]);
    for (const child of stream.children) {
      if (child.tag === "tdsn") child.data = encoded(parameter.label, localeSpec.encoding);
      if (child.tag === "cdat" && parameter.defaultValue !== undefined) {
        child.data.fill(0);
        child.data.writeDoubleBE(parameter.defaultValue, 0);
      }
      if (child.tag === "tdum") child.data.writeDoubleBE(parameter.sliderMin || 0, 0);
      if (child.tag === "tduM") child.data.writeDoubleBE(parameter.sliderMax || 0, 0);
      if (parameter.id === "target.layer" && child.tag === "tdsb") child.data.writeUInt32BE(1);
      if (parameter.id === "target.layer" && child.tag === "tdpi") child.data.writeUInt32BE(0);
      if (parameter.id === "target.layer" && child.tag === "tdb4") {
        child.data.writeUInt16BE(0x5da8, 14);
        // The cloned hidden input stream differs from all five native Layer
        // Control references at byte 72. Clear only that input-specific bit.
        // Evidence: assets/pseudo-effects/camera/source/native-layer-control-stream.json
        child.data[72] &= 0x7f;
      }
    }
    if (parameter.id === "target.layer") stream.children.push(leaf("tdps", uint(0)));
    streams.children.push(text("tdmn", name, "ascii", 40), stream);
    if (parameter.id) mapping[parameter.id] = index;
  }
  streams.children.push(text("tdmn", "ADBE Group End", "ascii", 40));
  function rename(node) {
    if (node.type === "parT" || node.type === "tdgp") return;
    if (node.tag === "tdmn" && node.data.toString().includes("Pseudo/9db0uID/Scribe")) {
      node.data = fixed(matchName, 40, "ascii");
    }
    if (node.tag === "tdsn" && node.data.toString().startsWith("Scribe")) {
      node.data = encoded(displayName, localeSpec.encoding);
    }
    if (node.tag === "fnam") node.data = fixed(displayName, 48, localeSpec.encoding);
    for (const child of node.children || []) rename(child);
  }
  rename(root);
  const bytes = pack(root);
  const structure = inspectPseudoEffectStructure(bytes, { visibleLayerParameterIndexes: [mapping["target.layer"]] });
  if (structure.parameterCount !== 28 || structure.groupStarts !== 6 || structure.groupEnds !== 6) {
    throw new Error("Camera parameter groups are invalid");
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  const templateId = `camera.rig/v3/${locale}`;
  catalog.templates[templateId] = {
    effectId: "camera.rig", schemaVersion: 3, locale,
    file: localeSpec.file, matchName, displayName,
    marker: { index: 27, name: schema.marker },
    parameters: mapping, sha256,
    validation: { status: "candidate", realAE: "pending", platforms: ["Windows"], targetAE: "2022–2026+" }
  };
  artifacts.push({ file: localeSpec.file, bytes });
}
for (const { file, bytes } of artifacts) {
  const target = path.join(outputDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  console.log(`${file}: ${bytes.length} bytes`);
}
for (const id of Object.keys(catalog.templates)) {
  if (/^camera\.rig\/v[12]\//.test(id)) delete catalog.templates[id];
}
// Use the existing shape compatibility policy: Unicode object names in AE,
// accepted ASCII parameter definitions, and an explicit creation notice.
catalog.templates["camera.rig/v3/ko"] = {
  ...catalog.templates["camera.rig/v3/en"],
  locale: "ko", displayName: schema.displayNames.ko,
  controlLocale: "en", sourceTemplateId: "camera.rig/v3/en"
};
fs.rmSync(path.join(outputDir, "ko/camera.ffx"), { force: true });
fs.writeFileSync(path.join(outputDir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
