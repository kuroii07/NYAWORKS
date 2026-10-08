import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { REQUIRED_DIST_FILES } from "../scripts/dist-contract.mjs";

const root = "public/host/pseudo-effects";
const id = "shape.roundedRectangle/v1/zh-CN";

describe("rounded rectangle pseudo-effect asset", () => {
  it("requires the template and its catalog in production builds", () => {
    expect(REQUIRED_DIST_FILES).toContain("dist/host/pseudo-effects/catalog.json");
    expect(REQUIRED_DIST_FILES).toContain("dist/host/pseudo-effects/rounded-rectangle-v1-zh-CN.ffx");
  });
  it("ships a single immutable template with the measured parameter mapping", async () => {
    const catalog = JSON.parse(await readFile(`${root}/catalog.json`, "utf8"));
    const schema = JSON.parse(
      await readFile("assets/pseudo-effects/rounded-rectangle/v1/schema.json", "utf8")
    );
    const template = catalog.templates[id];
    expect(Object.keys(catalog.templates)).toEqual([id]);
    expect(template.matchName).toBe("Pseudo/NYA_RRect_v1_zhCN");
    expect(template.file).toBe("rounded-rectangle-v1-zh-CN.ffx");
    expect(template.marker).toMatchObject({ index: 10, name: "__NYA_RRECT_V1__" });
    expect(template.parameters).toEqual({
      width: 1, height: 2, radius: 3, separate: 4,
      topLeftPercent: 6, topRightPercent: 7,
      bottomRightPercent: 8, bottomLeftPercent: 9
    });
    expect(schema.parameters.map(({ id, defaultValue }) => [id, defaultValue])).toEqual([
      ["width", 500], ["height", 500], ["radius", 50], ["separate", 0],
      ["topLeftPercent", 50], ["topRightPercent", 50],
      ["bottomRightPercent", 50], ["bottomLeftPercent", 50]
    ]);
    const bytes = await readFile(`${root}/${template.file}`);
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFX");
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase())
      .toBe(template.sha256);
  });
});
