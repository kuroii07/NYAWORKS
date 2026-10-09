import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import iconv from "iconv-lite";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "assets/pseudo-effects/rounded-rectangle/v2");
const outputRoot = path.join(projectRoot, "public/host/pseudo-effects");
const schema = JSON.parse(fs.readFileSync(path.join(sourceRoot, "schema.json"), "utf8"));
const original = fs.readFileSync(path.join(sourceRoot, "../source/base-scribe.ffx"));
const params = [
  { label: "", kind: 0, source: 0 },
  ...schema.parameters.slice(0, 4).map(parameter => ({
    label: parameter.label,
    kind: parameter.type === "checkbox" ? 4 : 10,
    value: parameter.defaultValue,
    max: parameter.max,
    percent: false
  })),
  { label: schema.group, kind: 13, source: 3 },
  ...schema.parameters.slice(4).map(parameter => ({
    label: parameter.label, kind: 10, value: parameter.defaultValue,
    max: parameter.max, percent: true
  })),
  { label: schema.marker, kind: 14, source: 7 }
];

if (schema.parameters.length !== 8 || params.length !== 11) {
  throw new Error("Rounded rectangle requires eight business parameters.");
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
function encoded(text) { return iconv.encode(text + "\0", "gbk"); }
function fixed(text, size) {
  const data = Buffer.alloc(size);
  const value = iconv.encode(text, "gbk");
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
    definition.data.writeFloatBE(0, 104);
    definition.data.writeFloatBE(parameter.max, 108);
    definition.data.writeFloatBE(0, 112);
    definition.data.writeFloatBE(parameter.percent ? 100 : 1000, 116);
    definition.data.writeFloatBE(parameter.value, 120);
    definition.data.writeInt16BE(2, 124);
    definition.data.writeUInt16BE(parameter.percent ? 1 : 0, 126);
  } else if (parameter.kind === 4) {
    definition.data.fill(0, 56);
    definition.data.writeUInt32BE(4, 48);
  }
  definitions.children.push(text("tdmn", matchName, 40), definition);
  if (parameter.kind === 4) definitions.children.push(text("pdnm", ""));
  const stream = clone(originalStreams[sourceIndex]);
  for (const child of stream.children) {
    if (child.tag === "tdsn") child.data = encoded(parameter.label);
    if (child.tag === "cdat" && parameter.value !== undefined) {
      child.data.fill(0);
      child.data.writeDoubleBE(parameter.value, 0);
    }
    if (child.tag === "tdum") child.data.writeDoubleBE(0, 0);
    if (child.tag === "tduM") child.data.writeDoubleBE(parameter.max || 0, 0);
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
const file = "rounded-rectangle-zh-CN.ffx";
const sha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
const catalog = {
  templates: {
    [schema.templateId]: {
      file,
      matchName: schema.matchName,
      marker: { index: 10, name: schema.marker },
      parameters: {
        width: 1, height: 2, radius: 3, separate: 4,
        topLeftPercent: 6, topRightPercent: 7,
        bottomRightPercent: 8, bottomLeftPercent: 9
      },
      sha256
    }
  }
};
fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, file), bytes);
fs.writeFileSync(path.join(outputRoot, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
for (const obsolete of [
  "rounded-rectangle-v1-zh-CN.ffx",
  "rounded-rectangle-v2-zh-CN.ffx"
]) {
  fs.rmSync(path.join(outputRoot, obsolete), { force: true });
}
console.log(`${file}: ${bytes.length} bytes, SHA-256 ${sha256}`);
