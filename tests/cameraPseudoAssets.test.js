import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { inspectPseudoEffectStructure } from "../scripts/pseudo-effect-structure.mjs";

const root = "public/host/pseudo-effects";
const linkageBaseline = "assets/pseudo-effects/camera/v2/accepted-linkage";
const targetBaseline = "assets/pseudo-effects/camera/v3/before-target-fix";

function chunks(bytes, start = 0, end = bytes.length) {
  const result = [];
  for (let at = start; at < end;) {
    const tag = bytes.toString("ascii", at, at + 4);
    const length = bytes.readUInt32BE(at + 4);
    if (at + 8 + length > end) throw new Error("invalid-ffx-boundary");
    result.push(tag === "RIFX" || tag === "LIST" ? {
      tag, type: bytes.toString("ascii", at + 8, at + 12),
      children: chunks(bytes, at + 12, at + 8 + length)
    } : { tag, data: bytes.subarray(at + 8, at + 8 + length) });
    at += 8 + length + length % 2;
  }
  return result;
}

function findTable(nodes, type) {
  for (const node of nodes) {
    if (node.type === type) return node;
    const nested = node.children && findTable(node.children, type);
    if (nested) return nested;
  }
}

function groupBalance(bytes) {
  const table = findTable(chunks(bytes), "parT");
  let depth = 0;
  const result = { starts: 0, ends: 0, orphanEnds: [], unclosed: 0 };
  table.children.filter(node => node.tag === "pard").forEach((node, index) => {
    const kind = node.data.readUInt32BE(12);
    if (kind === 13) { depth++; result.starts++; }
    if (kind === 14) {
      result.ends++;
      if (depth === 0) result.orphanEnds.push(index);
      else depth--;
    }
  });
  result.unclosed = depth;
  return result;
}

describe("camera controller pseudo-effect candidate", () => {
  it.each(["camera-zh-CN.ffx", "zh-TW/camera.ffx", "en/camera.ffx", "ja/camera.ffx"])(
    "uses the visible native Layer Control stream inside the target group: %s", async file => {
      const nodes = chunks(await readFile(`${root}/${file}`));
      const definitions = findTable(nodes, "parT").children.filter(node => node.tag === "pard");
      const streams = findTable(nodes, "tdgp").children.filter(node => node.type === "tdbs");
      expect(definitions.slice(1, 4).map(node => node.data.readUInt32BE(12))).toEqual([13, 0, 14]);
      const reference = JSON.parse(await readFile("assets/pseudo-effects/camera/source/native-layer-control-stream.json", "utf8"));
      expect(streams[2].children.filter(node => node.tag !== "tdsn").map(node => ({ tag: node.tag, hex: node.data.toString("hex") })))
        .toEqual(reference.stream);
    }
  );

  it.each(["zh-CN", "zh-TW", "en", "ja"])("rejects the previously hidden target stream when visibility is required: %s", async locale => {
    const bytes = await readFile(`assets/pseudo-effects/camera/v3/before-target-fix/camera-${locale}.ffx`);
    expect(() => inspectPseudoEffectStructure(bytes, { visibleLayerParameterIndexes: [2] }))
      .toThrow("ffx-hidden-layer-control:2");
  });

  it.each(["camera-zh-CN.ffx", "zh-TW/camera.ffx", "en/camera.ffx", "ja/camera.ffx"])(
    "pairs every group end with a start in the actual delivered bytes: %s", async file => {
      expect(groupBalance(await readFile(`${root}/${file}`))).toEqual({
        starts: 6, ends: 6, orphanEnds: [], unclosed: 0
      });
    }
  );

  it.each(["zh-CN", "zh-TW", "en", "ja"])("preserves all pre-marker definitions and value streams byte-for-byte: %s", async locale => {
    const file = locale === "zh-CN" ? "camera-zh-CN.ffx" : `${locale}/camera.ffx`;
    const oldNodes = chunks(await readFile(`assets/pseudo-effects/camera/v1/rejected/camera-${locale}.ffx`));
    const newNodes = chunks(await readFile(`${linkageBaseline}/camera-${locale}.ffx`));
    const definitions = nodes => findTable(nodes, "parT").children.filter(node => node.tag === "pard");
    const streams = nodes => findTable(nodes, "tdgp").children.filter(node => node.type === "tdbs");
    expect(definitions(newNodes).slice(0, 27)).toEqual(definitions(oldNodes).slice(0, 27));
    expect(streams(newNodes).slice(0, 27)).toEqual(streams(oldNodes).slice(0, 27));
  });

  it.each(["zh-CN", "zh-TW", "en", "ja"])("only changes offset labels/ranges and version identity from the working v2 bytes: %s", async locale => {
    const file = locale === "zh-CN" ? "camera-zh-CN.ffx" : `${locale}/camera.ffx`;
    const previous = chunks(await readFile(`${linkageBaseline}/camera-${locale}.ffx`));
    const current = chunks(await readFile(`${targetBaseline}/camera-${locale}.ffx`));
    const definitions = nodes => findTable(nodes, "parT").children.filter(node => node.tag === "pard");
    const streams = nodes => findTable(nodes, "tdgp").children.filter(node => node.type === "tdbs");
    for (const index of [5, 6, 7]) {
      const data = definitions(current)[index].data;
      expect([104, 108, 112, 116, 120].map(offset => data.readFloatBE(offset)))
        .toEqual([-100000, 100000, -500, 500, 0]);
      const children = streams(current)[index].children;
      expect(children.find(node => node.tag === "tdum").data.readDoubleBE(0)).toBe(-500);
      expect(children.find(node => node.tag === "tduM").data.readDoubleBE(0)).toBe(500);
      // Allow only the label and UI-range bytes; preserve defaults, validity,
      // parameter kinds, animation streams and all other opaque AE metadata.
      definitions(previous)[index].data.copy(data, 16, 16, 48);
      definitions(previous)[index].data.copy(data, 112, 112, 120);
      for (const tag of ["tdsn", "tdum", "tduM"]) {
        children.find(node => node.tag === tag).data = streams(previous)[index].children.find(node => node.tag === tag).data;
      }
    }
    definitions(previous)[27].data.copy(definitions(current)[27].data, 16, 16, 48);
    streams(current)[27].children.find(node => node.tag === "tdsn").data =
      streams(previous)[27].children.find(node => node.tag === "tdsn").data;
    const restoreIdentity = nodes => nodes.forEach(node => {
      if (node.tag === "tdmn") node.data = Buffer.from(node.data.toString("ascii").replace("NYA_Camera_v3_", "NYA_Camera_v2_"), "ascii");
      if (node.children) restoreIdentity(node.children);
    });
    restoreIdentity(current);
    expect(current).toEqual(previous);
  });

  it.each(["zh-CN", "zh-TW", "en", "ja"])("preserves all v3 bytes except target stream visibility and revised identities: %s", async locale => {
    const file = locale === "zh-CN" ? "camera-zh-CN.ffx" : `${locale}/camera.ffx`;
    const previous = chunks(await readFile(`${targetBaseline}/camera-${locale}.ffx`));
    const current = chunks(await readFile(`${root}/${file}`));
    const stream = nodes => findTable(nodes, "tdgp").children.filter(node => node.type === "tdbs")[2];
    const oldState = stream(previous).children.find(node => node.tag === "tdsb").data;
    const newState = stream(current).children.find(node => node.tag === "tdsb").data;
    expect(oldState.readUInt32BE()).toBe(3);
    expect(newState.readUInt32BE()).toBe(1);
    oldState.copy(newState);
    const oldMetadata = stream(previous).children.find(node => node.tag === "tdb4").data;
    const newMetadata = stream(current).children.find(node => node.tag === "tdb4").data;
    expect(oldMetadata[72]).toBe(0x80);
    expect(newMetadata[72]).toBe(0);
    newMetadata[72] = oldMetadata[72];
    const identities = {
      "zh-CN": ["zhCN_r2", "zhCN"], "zh-TW": ["zhTW_r2", "zhTW"],
      en: ["en_r2", "en"], ja: ["ja_r3", "ja_r2"]
    };
    const [suffix, previousSuffix] = identities[locale];
    const restoreIdentity = nodes => nodes.forEach(node => {
      if (node.tag === "tdmn") {
        const restored = node.data.toString("ascii").split("\0")[0]
          .replace(`NYA_Camera_v3_${suffix}`, `NYA_Camera_v3_${previousSuffix}`);
        node.data = Buffer.alloc(node.data.length);
        node.data.write(restored, "ascii");
      }
      if (node.children) restoreIdentity(node.children);
    });
    restoreIdentity(current);
    expect(current).toEqual(previous);
    expect(inspectPseudoEffectStructure(await readFile(`${root}/${file}`), { visibleLayerParameterIndexes: [2] }))
      .toMatchObject({ parameterCount: 28, groupStarts: 6, groupEnds: 6 });
  });

  it("defines the approved fifteen semantic controls and six foldable groups", async () => {
    const schema = JSON.parse(await readFile("assets/pseudo-effects/camera/v3/schema.json", "utf8"));
    const previousSchema = JSON.parse(await readFile("assets/pseudo-effects/camera/v1/schema.json", "utf8"));
    expect(schema.parameters.map((parameter, index) => parameter.id.startsWith("position.") ? {
      ...parameter, sliderMin: previousSchema.parameters[index].sliderMin,
      sliderMax: previousSchema.parameters[index].sliderMax, labels: previousSchema.parameters[index].labels
    } : parameter)).toEqual(previousSchema.parameters);
    expect(schema.groups).toEqual(previousSchema.groups);
    expect(schema.groups.map(group => group.id)).toEqual([
      "target", "transform", "motion", "lens", "focus", "shake"
    ]);
    expect(schema.parameters.map(parameter => parameter.id)).toEqual([
      "target.layer", "position.x", "position.y", "position.z",
      "rotation.x", "rotation.y", "rotation.z", "motion.enabled", "motion.speed",
      "lens.focalLength", "lens.depthOfField", "focus.auto", "focus.distance",
      "shake.strength", "shake.frequency"
    ]);
    const expected = [
      ["target.layer", "layer", 0],
      ["position.x", "slider", 0, -500, 500, -100000, 100000],
      ["position.y", "slider", 0, -500, 500, -100000, 100000],
      ["position.z", "slider", 0, -500, 500, -100000, 100000],
      ["rotation.x", "angle", 0], ["rotation.y", "angle", 0], ["rotation.z", "angle", 0],
      ["motion.enabled", "checkbox", 0],
      ["motion.speed", "slider", 0, -2000, 2000, -10000, 10000],
      ["lens.focalLength", "slider", 35, 1, 200, 1, 1000],
      ["lens.depthOfField", "checkbox", 0], ["focus.auto", "checkbox", 0],
      ["focus.distance", "slider", 1000, 1, 10000, 1, 100000],
      ["shake.strength", "slider", 0, 0, 300, 0, 5000],
      ["shake.frequency", "slider", 2, 0, 20, 0, 100]
    ];
    expect(schema.parameters.map(parameter => [
      parameter.id, parameter.type, parameter.defaultValue,
      ...(parameter.type === "slider" ? [
        parameter.sliderMin, parameter.sliderMax, parameter.validMin, parameter.validMax
      ] : [])
    ])).toEqual(expected);
    for (const parameter of schema.parameters) {
      expect(Object.keys(parameter.labels)).toEqual(["zh-CN", "zh-TW", "en", "ja", "ko"]);
      expect(Object.values(parameter.labels).every(label => label.startsWith("Nya "))).toBe(true);
    }
  });

  it("ships five explicit locale routes with verified hashes and fixed mappings", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    expect(Object.keys(catalog.templates).some(id => /^camera\.rig\/v[12]\//.test(id))).toBe(false);
    for (const locale of ["zh-CN", "zh-TW", "en", "ja", "ko"]) {
      const id = `camera.rig/v3/${locale}`;
      const definition = catalog.templates[id];
      expect(definition).toMatchObject({
        effectId: "camera.rig", schemaVersion: 3, locale,
        marker: { index: 27, name: "__NYA_CAMERA_V3__" }
      });
      expect(Object.keys(definition.parameters)).toHaveLength(15);
      const bytes = await readFile(`${root}/${definition.file}`);
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(definition.sha256);
    }
  });

  it("maps Korean names to the accepted English controls without reauthoring any FFX", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const english = catalog.templates["camera.rig/v3/en"];
    expect(catalog.templates["camera.rig/v3/ko"]).toEqual({
      ...english, locale: "ko", displayName: "Nya 카메라 컨트롤",
      controlLocale: "en", sourceTemplateId: "camera.rig/v3/en"
    });
    const acceptedHashes = {
      "camera-zh-CN.ffx": "8086379C3C0818F037DE1CB0C7A5E31382CC14974E00F048DFCF133F12623CCB",
      "zh-TW/camera.ffx": "B7C9CCB13C3CDB16166394F1EF1E0FF53E9CC5A9F52698537285EE5BCD012E31",
      "en/camera.ffx": "65FAB1D5F22CEB1BF5CE7A21E437424F330CC5DAEC387C100B982D6612245069",
      "ja/camera.ffx": "65CE104856C2DECCEE79A54D8F91CD941BBB39D22B53DF9DF5D623E6D77DCC05"
    };
    for (const [file, sha] of Object.entries(acceptedHashes)) {
      expect(createHash("sha256").update(await readFile(`${root}/${file}`)).digest("hex").toUpperCase()).toBe(sha);
    }
  });

  it.each(["zh-CN", "zh-TW", "en", "ja"])("rejects the actual archived malformed v1 artifact: %s", async locale => {
    const bytes = await readFile(`assets/pseudo-effects/camera/v1/rejected/camera-${locale}.ffx`);
    expect(groupBalance(bytes)).toEqual({ starts: 6, ends: 7, orphanEnds: [28], unclosed: 0 });
    expect(() => inspectPseudoEffectStructure(bytes)).toThrow("ffx-orphan-group-end:28");
  });

  it.each(["rounded-rectangle-zh-CN.ffx", "circle-zh-CN.ffx", "triangle-zh-CN.ffx", "star-zh-CN.ffx"])(
    "accepts the existing approved shape group structure: %s", async file => {
      const structure = inspectPseudoEffectStructure(await readFile(`${root}/${file}`));
      expect(structure.groupStarts).toBe(structure.groupEnds);
    }
  );

  it("rebuilds matching v3 artifacts without changing non-camera catalog entries", async () => {
    const output = await mkdtemp(path.join(tmpdir(), "nya-camera-v3-"));
    try {
      execFileSync(process.execPath, ["scripts/build-camera-pseudo-effects.mjs", "--output-dir", output], { timeout: 10000 });
      const delivered = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
      const rebuilt = JSON.parse(await readFile(path.join(output, "catalog.json"), "utf8"));
      expect(rebuilt).toEqual(delivered);
      const baseline = JSON.parse(await readFile(`${linkageBaseline}/catalog.json`, "utf8"));
      const nonCamera = catalog => Object.fromEntries(Object.entries(catalog.templates).filter(([id]) => !id.startsWith("camera.rig/")));
      expect(nonCamera(rebuilt)).toEqual(nonCamera(baseline));
      for (const entry of Object.values(nonCamera(baseline))) {
        expect(createHash("sha256").update(await readFile(`${root}/${entry.file}`)).digest("hex").toUpperCase()).toBe(entry.sha256);
      }
      const previous = JSON.parse((await readFile("assets/pseudo-effects/camera/v1/rejected/catalog-v1.json", "utf8")).replace(/^\uFEFF/, ""));
      for (const locale of ["zh-CN", "zh-TW", "en", "ja"]) {
        const entry = rebuilt.templates[`camera.rig/v3/${locale}`];
        expect(entry.parameters).toEqual(previous[`camera.rig/v1/${locale}`].parameters);
        const bytes = await readFile(path.join(output, entry.file));
        expect(bytes).toEqual(await readFile(`${root}/${entry.file}`));
        expect(inspectPseudoEffectStructure(bytes)).toMatchObject({ parameterCount: 28, groupStarts: 6, groupEnds: 6 });
      }
    } finally { await rm(output, { recursive: true, force: true }); }
  });
});
