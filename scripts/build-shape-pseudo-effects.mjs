import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import iconv from "iconv-lite";
import { validateShapeStrokeWidth } from "./shape-pseudo-effect-contract.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "public/host/pseudo-effects");
const original = fs.readFileSync(path.join(
  projectRoot, "assets/pseudo-effects/rounded-rectangle/source/base-scribe.ffx"
));
// Locales require independently authored definitions. Never interpret an
// arbitrary locale/path as a schema directory or silently copy Chinese bytes.
const localeArgument = process.argv.slice(2);
if (localeArgument.length > 1 || (localeArgument.length === 1 && !/^--locale=(zh-CN|en|zh-TW)$/.test(localeArgument[0]))) {
  throw new Error("Supported authoring modes: --locale=zh-CN, --locale=en or --locale=zh-TW");
}
const locale = localeArgument[0]?.slice("--locale=".length) ?? "zh-CN";
const templates = [
  { source: "rounded-rectangle/v7", file: "rounded-rectangle-zh-CN.ffx", layout: "rectangle" },
  { source: "circle/v3", file: "circle-zh-CN.ffx", layout: "circle" },
  { source: "triangle/v1", file: "triangle-zh-CN.ffx", layout: "triangle", nativeDefaults: true },
  { source: "star/v2", file: "star-zh-CN.ffx", layout: "star", nativeDefaults: true }
].map(template => locale === "zh-CN" ? template : {
  ...template,
  source: `${template.source}/${locale}`,
  file: `${locale}/${template.file.replace(/-zh-CN\.ffx$/, ".ffx")}`,
  nativeDefaults: true
});
function numericParameter(parameter, percent) {
  return {
    label: parameter.label,
    kind: 10,
    value: parameter.defaultValue,
    sliderMin: parameter.sliderMin,
    sliderMax: parameter.sliderMax,
    validMin: parameter.validMin,
    validMax: parameter.validMax,
    precision: parameter.precision ?? 2,
    percent
  };
}
function businessParameter(parameter) {
  if (parameter.type === "checkbox") {
    return { id: parameter.id, label: parameter.label, kind: 4, value: parameter.defaultValue };
  }
  if (parameter.type === "color") {
    return { id: parameter.id, label: parameter.label, kind: 5, source: 1, value: parameter.defaultValue };
  }
  if (parameter.type === "angle") {
    return { id: parameter.id, label: parameter.label, kind: 3, value: parameter.defaultValue };
  }
  if (parameter.type === "slider" || parameter.type === "percent") {
    return { id: parameter.id, ...numericParameter(parameter, parameter.type === "percent") };
  }
  throw new Error(`Unsupported pseudo-effect parameter type: ${parameter.type}`);
}

function layoutParameters(schema, layout) {
  validateShapeStrokeWidth(schema);
  const business = schema.parameters.map(businessParameter);
  let expected;
  if (layout === "rectangle") {
    expected = ["width", "height", "radius", "separate", "topLeftPercent", "topRightPercent",
      "bottomRightPercent", "bottomLeftPercent", "fillEnabled", "fillColor",
      "strokeEnabled", "strokeColor", "strokeWidth"];
  } else if (layout === "circle") {
    expected = ["radius", "fillEnabled", "fillColor", "strokeEnabled", "strokeColor", "strokeWidth"];
  } else if (layout === "triangle") {
    expected = ["points", "rotation", "outerRadius", "outerRoundness",
      "fillEnabled", "fillColor", "strokeEnabled", "strokeColor", "strokeWidth"];
  } else if (layout === "star") {
    expected = ["points", "outerRadius", "innerRadius", "rotation", "outerRoundness", "innerRoundness",
      "fillEnabled", "fillColor", "strokeEnabled", "strokeColor", "strokeWidth"];
  } else {
    throw new Error(`Unsupported pseudo-effect layout: ${layout}`);
  }
  if (business.length !== expected.length ||
      business.some((parameter, index) => parameter.id !== expected[index]) ||
      new Set(business.map(parameter => parameter.id)).size !== business.length) {
    throw new Error(`Invalid pseudo-effect parameter mapping: ${schema.templateId}`);
  }
  const style = { label: schema.styleGroup, kind: 13, source: 3 };
  const endGroup = { label: "", kind: 14, source: 7 };
  let params;
  if (layout === "rectangle") {
    params = [
        { label: "", kind: 0, source: 0 },
        ...business.slice(0, 4),
        { label: schema.group, kind: 13, source: 3 },
        ...business.slice(4, 8),
        endGroup, style, ...business.slice(8),
        { label: schema.marker, kind: 14, source: 7 }
      ];
  } else if (layout === "circle") {
    params = [
        { label: "", kind: 0, source: 0 },
        business[0], style, ...business.slice(1),
        { label: schema.marker, kind: 14, source: 7 }
      ];
  } else {
    const geometryCount = layout === "triangle" ? 4 : 6;
    params = [
      { label: "", kind: 0, source: 0 },
      ...business.slice(0, geometryCount), style, ...business.slice(geometryCount),
      { label: schema.marker, kind: 14, source: 7 }
    ];
  }
  for (const parameter of params) {
    if (parameter.kind !== 10) continue;
    const range = [
      parameter.validMin, parameter.sliderMin, parameter.value,
      parameter.sliderMax, parameter.validMax
    ];
    if (!range.every(Number.isFinite) ||
        parameter.validMin > parameter.sliderMin ||
        parameter.sliderMin > parameter.value ||
        parameter.value > parameter.sliderMax ||
        parameter.sliderMax > parameter.validMax) {
      throw new Error(`Invalid numeric range for ${parameter.label}.`);
    }
  }
  return params;
}

function parse(bytes, start = 0, end = bytes.length) {
  const result = [];
  for (let at = start; at < end;) {
    const tag = bytes.toString("ascii", at, at + 4);
    const length = bytes.readUInt32BE(at + 4);
    if (at + 8 + length > end) throw new Error("Invalid FFX chunk boundary.");
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
    const found = find(child, type);
    if (found) return found;
  }
  return null;
}

function clone(node) { return parse(pack(node))[0]; }
function checkedEncoding(text) {
  const bytes = iconv.encode(text, "gbk");
  if (iconv.decode(bytes, "gbk") !== text) throw new Error(`FFX label cannot be represented in GBK: ${text}`);
  return bytes;
}
function encoded(text) { return checkedEncoding(text + "\0"); }
function fixed(text, size) {
  const data = Buffer.alloc(size);
  const value = checkedEncoding(text);
  if (value.length >= size) throw new Error(`FFX label too long: ${text}`);
  value.copy(data);
  return data;
}
function leaf(tag, data) { return { tag, data }; }
function number(value) {
  const data = Buffer.alloc(4);
  data.writeUInt32BE(value);
  return data;
}
function text(tag, value, length) {
  return leaf(tag, length ? fixed(value, length) : encoded(value));
}

const catalog = JSON.parse(fs.readFileSync(path.join(outputRoot, "catalog.json"), "utf8"));
const generatedIds = new Set();
const artifacts = [];
for (const template of templates) {
const schema = JSON.parse(fs.readFileSync(path.join(
  projectRoot, "assets/pseudo-effects", template.source, "schema.json"
), "utf8"));
const params = layoutParameters(schema, template.layout);
if (generatedIds.has(schema.templateId)) throw new Error(`Duplicate template ID: ${schema.templateId}`);
generatedIds.add(schema.templateId);
if (locale !== "zh-CN") {
  const baseline = JSON.parse(fs.readFileSync(path.join(projectRoot, "assets/pseudo-effects", template.source.replace(/\/(en|zh-TW)$/, ""), "schema.json"), "utf8"));
  const semanticParameters = parameters => parameters.map(({ label, ...contract }) => contract);
  if (schema.templateId !== baseline.templateId.replace(/zh-CN$/, locale) ||
      schema.definitionRevision !== (locale === "en" ? 2 : 1) ||
      schema.matchName !== baseline.matchName.replace(/zhCN$/, locale === "en" ? "en_r2" : "zhTW") || schema.marker !== baseline.marker ||
      JSON.stringify(semanticParameters(schema.parameters)) !== JSON.stringify(semanticParameters(baseline.parameters))) {
    throw new Error(`Localized schema changed the frozen semantic contract: ${schema.templateId}`);
  }
  // The reported mixed labels coincide with bare AE terms. Namespace every
  // visible control/group; the fresh identity also avoids cached definitions.
  if ([schema.styleGroup, schema.group, ...schema.parameters.map(parameter => parameter.label)]
      .filter(label => label !== undefined).some(label => !label.startsWith("Nya ") ||
        (locale === "en" && !/^Nya [\x20-\x7e]+$/.test(label)))) {
    throw new Error(`Localized pseudo-effect labels require the Nya namespace: ${schema.templateId}`);
  }
}
const root = parse(original)[0];
const definitions = find(root, "parT");
const values = find(root, "tdgp");
if (!definitions || !values) throw new Error("MIT sample format changed.");
const originalDefinitions = definitions.children.filter(child => child.tag === "pard");
const originalStreams = values.children.filter(child => child.type === "tdbs");
definitions.children = [leaf("parn", number(params.length))];
values.children = [leaf("tdsb", number(1)), text("tdsn", schema.displayName)];

for (const [index, parameter] of params.entries()) {
  const matchName = `${schema.matchName}-${String(index).padStart(4, "0")}`;
  const sourceIndex = parameter.source ?? 2;
  const definition = clone(originalDefinitions[sourceIndex]);
  definition.data.fill(0, 16, 48);
  fixed(parameter.label, 32).copy(definition.data, 16);
  definition.data.writeUInt32BE(parameter.kind, 12);
  if (parameter.kind === 10) {
    definition.data.fill(0, 56);
    definition.data.writeDoubleBE(parameter.value, 56);
    // Match the original Scribe pseudo-effect layout: the first pair is the
    // typed-input range, while the second pair is the drag range.
    definition.data.writeFloatBE(parameter.validMin, 104);
    definition.data.writeFloatBE(parameter.validMax, 108);
    definition.data.writeFloatBE(parameter.sliderMin, 112);
    definition.data.writeFloatBE(parameter.sliderMax, 116);
    definition.data.writeFloatBE(parameter.value, 120);
    definition.data.writeInt16BE(parameter.precision, 124);
    definition.data.writeUInt16BE(parameter.percent ? 1 : 0, 126);
  } else if (parameter.kind === 3) {
    definition.data.fill(0, 56);
    definition.data.writeInt32BE(parameter.value, 56);
  } else if (parameter.kind === 4) {
    definition.data.fill(0, 56);
    definition.data.writeUInt32BE(4, 48);
    if (template.nativeDefaults) {
      definition.data.writeUInt32BE(parameter.value, 56);
      // PF_CheckBoxDef.dephault is a one-byte PF_Boolean, not a BE32 value.
      definition.data.writeUInt8(parameter.value, 60);
    }
  } else if (parameter.kind === 5 && template.nativeDefaults) {
    definition.data.fill(0, 56);
    const color = [parameter.value[3], parameter.value[0], parameter.value[1], parameter.value[2]];
    for (let channel = 0; channel < 4; channel += 1) {
      const value = Math.round(color[channel] * 255);
      definition.data.writeUInt8(value, 56 + channel);
      definition.data.writeUInt8(value, 60 + channel);
    }
  }
  definitions.children.push(text("tdmn", matchName, 40), definition);
  if (parameter.kind === 4) definitions.children.push(text("pdnm", ""));
  const stream = clone(originalStreams[sourceIndex]);
  for (const child of stream.children) {
    if (child.tag === "tdsn") child.data = encoded(parameter.label);
    if (child.tag === "cdat" && parameter.kind === 5) {
      child.data.fill(0);
      // New definitions use AE's native ARGB stream order. Keep the approved
      // rectangle/circle definition bytes intact under their existing identity.
      const color = template.nativeDefaults
        ? [parameter.value[3], parameter.value[0], parameter.value[1], parameter.value[2]]
        : parameter.value;
      for (let channel = 0; channel < 4; channel += 1) {
        child.data.writeDoubleBE(color[channel] * 255, channel * 8);
      }
    } else if (child.tag === "cdat" && parameter.value !== undefined) {
      child.data.fill(0);
      child.data.writeDoubleBE(parameter.value, 0);
    }
    // AE renders the stream bounds beside the slider, so keep them aligned
    // with the drag range while the parameter definition retains typed input bounds.
    if (child.tag === "tdum") child.data.writeDoubleBE(parameter.sliderMin || 0, 0);
    if (child.tag === "tduM") child.data.writeDoubleBE(parameter.sliderMax || 0, 0);
  }
  values.children.push(text("tdmn", matchName, 40), stream);
}
values.children.push(text("tdmn", "ADBE Group End", 40));

function renameContainer(node) {
  if (node.type === "parT" || node.type === "tdgp") return;
  if (node.tag === "tdmn" && node.data.toString().includes("Pseudo/9db0uID/Scribe")) {
    node.data = fixed(schema.matchName, 40);
  }
  if (node.tag === "tdsn" && node.data.toString().startsWith("Scribe")) {
    node.data = encoded(schema.displayName);
  }
  if (node.tag === "fnam") node.data = fixed(schema.displayName, 48);
  for (const child of node.children || []) renameContainer(child);
}
renameContainer(root);

const bytes = pack(root);
const sha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
const parameterMap = {};
for (const [index, parameter] of params.entries()) {
  if (parameter.id) parameterMap[parameter.id] = index;
}
catalog.templates[schema.templateId] = {
  file: template.file,
  matchName: schema.matchName,
  marker: { index: params.length - 1, name: schema.marker },
  parameters: parameterMap,
  sha256
};
if (locale !== "zh-CN") {
  const [effectId, version] = schema.templateId.split("/");
  Object.assign(catalog.templates[schema.templateId], {
    effectId, shape: template.file.split("/").pop().replace(/\.ffx$/, ""),
    schemaVersion: Number(version.slice(1)), definitionRevision: schema.definitionRevision,
    locale, displayName: schema.displayName,
    parameterDefinitions: schema.parameters,
    validation: { status: "candidate", realAE: "pending", platforms: ["Windows"], targetAE: "2022–2026+" }
  });
}
artifacts.push({ file: template.file, bytes });
console.log(`${template.file}: ${bytes.length} bytes, SHA-256 ${sha256}`);
}
// Explicitly approved compatibility mode: Japanese/Korean object names use
// Unicode AE DOM strings; controls share the accepted ASCII English definition.
// Do not encode Korean parameter names into an ANSI slot or disguise a fallback.
if (locale === "en") {
  const names = JSON.parse(fs.readFileSync(path.join(projectRoot, "assets/pseudo-effects/shape-locale-names.json"), "utf8"));
  for (const language of ["ja", "ko"]) {
    for (const englishId of generatedIds) {
      const english = catalog.templates[englishId];
      catalog.templates[englishId.replace(/\/en$/, `/${language}`)] = {
        ...english, locale: language, displayName: names[language][english.effectId],
        controlLocale: "en", sourceTemplateId: englishId
      };
    }
  }
}
for (const artifact of artifacts) {
  fs.mkdirSync(path.dirname(path.join(outputRoot, artifact.file)), { recursive: true });
  fs.writeFileSync(path.join(outputRoot, artifact.file), artifact.bytes);
}
fs.writeFileSync(path.join(outputRoot, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
for (const obsolete of locale === "zh-CN" ? [
  "rounded-rectangle-v1-zh-CN.ffx",
  "rounded-rectangle-v2-zh-CN.ffx"
] : []) {
  fs.rmSync(path.join(outputRoot, obsolete), { force: true });
}
