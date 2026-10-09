import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { REQUIRED_DIST_FILES } from "../scripts/dist-contract.mjs";

const root = "public/host/pseudo-effects";
const id = "shape.roundedRectangle/v2/zh-CN";

describe("rounded rectangle pseudo-effect asset", () => {
  it("requires only the approved, version-free preset and its catalog in production builds", () => {
    expect(REQUIRED_DIST_FILES).toContain("dist/host/pseudo-effects/catalog.json");
    expect(REQUIRED_DIST_FILES.filter(file => file.endsWith(".ffx"))).toEqual([
      "dist/host/pseudo-effects/rounded-rectangle-zh-CN.ffx"
    ]);
  });

  it("ships only the working round-rectangle effect with 0–100 roundness", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    expect(Object.keys(catalog.templates)).toEqual([id]);
    const template = catalog.templates[id];
    expect(template.matchName).toBe("Pseudo/NYA_RRect_v2_zhCN");
    expect(template.file).toBe("rounded-rectangle-zh-CN.ffx");
    expect(template.marker).toMatchObject({ index: 10, name: "__NYA_RRECT_V2__" });
    expect(template.parameters).toEqual({
      width: 1, height: 2, radius: 3, separate: 4,
      topLeftPercent: 6, topRightPercent: 7,
      bottomRightPercent: 8, bottomLeftPercent: 9
    });
    const schema = JSON.parse(
      await readFile("assets/pseudo-effects/rounded-rectangle/v2/schema.json", "utf8")
    );
    expect(schema.parameters.find(({ id }) => id === "radius")).toMatchObject({
      defaultValue: 50,
      max: 100
    });
    expect((await readdir(root)).filter(file => file.endsWith(".ffx"))).toEqual([
      "rounded-rectangle-zh-CN.ffx"
    ]);
    const bytes = await readFile(`${root}/${template.file}`);
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(template.sha256);
  });
});
