import { describe, expect, it } from "vitest";
import { BUILT_IN_HOME_LAYOUTS } from "../src/homeLayouts/catalog";
import {
  createHomeLayoutPreset,
  parseHomeLayoutPreset
} from "../src/settings/homeLayoutPreset";
import type { HomeLayout } from "../src/homeLayouts/types";

const customLayout: HomeLayout = {
  ...BUILT_IN_HOME_LAYOUTS[0],
  id: "custom:test",
  kind: "custom",
  name: { kind: "custom", value: "测试布局" },
  groups: BUILT_IN_HOME_LAYOUTS[0].groups.map((group) => ({
    ...group,
    toolSlots: [...group.toolSlots]
  }))
};

describe("home layout presets", () => {
  it("exports one layout without unrelated application settings", () => {
    const preset = createHomeLayoutPreset(
      customLayout,
      "2026-09-24T10:00:00.000Z"
    );
    const json = JSON.stringify(preset);

    expect(preset.layout.groups.every((group) => group.toolSlots.length === 7))
      .toBe(true);
    expect(json).not.toContain("theme");
    expect(json).not.toContain("language");
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("createMode");
  });

  it("turns unknown imported tools and icons into safe values", () => {
    const imported = parseHomeLayoutPreset(
      JSON.stringify({
        schemaVersion: 1,
        product: "NYAWORKS",
        layout: {
          name: { kind: "custom", value: "Imported" },
          groups: [
            {
              id: "group:one",
              name: { kind: "custom", value: "Group" },
              iconId: "unknown",
              visible: true,
              toolSlots: ["unknown-tool"]
            }
          ]
        }
      }),
      {
        id: "custom:imported",
        now: "2026-09-24T10:00:00.000Z",
        existingNames: []
      }
    );

    expect(imported.kind).toBe("custom");
    expect(imported.groups[0].iconId).toBe("folder");
    expect(imported.groups[0].toolSlots).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ]);
  });

  it("rejects invalid files and duplicate layout names", () => {
    expect(() =>
      parseHomeLayoutPreset(
        JSON.stringify({ schemaVersion: 1, product: "OtherApp" }),
        {
          id: "custom:bad",
          now: "2026-09-24T10:00:00.000Z",
          existingNames: []
        }
      )
    ).toThrow("INVALID_HOME_LAYOUT_PRESET");

    expect(() =>
      parseHomeLayoutPreset(JSON.stringify(createHomeLayoutPreset(customLayout)), {
        id: "custom:duplicate",
        now: "2026-09-24T10:00:00.000Z",
        existingNames: [" 测试布局 "]
      })
    ).toThrow("DUPLICATE_HOME_LAYOUT_NAME");
  });
});
