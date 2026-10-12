import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = "public/host/pseudo-effects";

describe("camera controller pseudo-effect candidate", () => {
  it("defines the approved fifteen semantic controls and six foldable groups", async () => {
    const schema = JSON.parse(await readFile("assets/pseudo-effects/camera/v1/schema.json", "utf8"));
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
      ["position.x", "slider", 0, -10000, 10000, -100000, 100000],
      ["position.y", "slider", 0, -10000, 10000, -100000, 100000],
      ["position.z", "slider", 0, -20000, 20000, -100000, 100000],
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

  it("ships only the four AE-readable candidates with verified hashes and fixed mappings", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    expect(catalog.templates["camera.rig/v1/ko"]).toBeUndefined();
    for (const locale of ["zh-CN", "zh-TW", "en", "ja"]) {
      const id = `camera.rig/v1/${locale}`;
      const definition = catalog.templates[id];
      expect(definition).toMatchObject({
        effectId: "camera.rig", schemaVersion: 1, locale,
        marker: { index: 28, name: "__NYA_CAMERA_V1__" }
      });
      expect(Object.keys(definition.parameters)).toHaveLength(15);
      const bytes = await readFile(`${root}/${definition.file}`);
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(definition.sha256);
    }
  });
});
