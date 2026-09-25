import { describe, expect, it } from "vitest";
import { BUILT_IN_CREATIVE_LAYOUT_ID } from "../src/homeLayouts/catalog";
import {
  HOME_SETTINGS_STORAGE_KEY,
  getActiveHomeLayout,
  normalizeHomeSettings,
  readStoredHomeSettings,
  writeStoredHomeSettings
} from "../src/settings/homeSettingsStorage";
import { DEFAULT_HOME_SETTINGS } from "../src/settings/types";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("home settings storage", () => {
  it("returns safe defaults when no saved value exists", () => {
    expect(readStoredHomeSettings()).toEqual(DEFAULT_HOME_SETTINGS);
    expect(DEFAULT_HOME_SETTINGS.showQuickPanels).toBe(true);
  });

  it("falls back to the built-in layout when stored data is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(HOME_SETTINGS_STORAGE_KEY, "{broken");

    expect(readStoredHomeSettings(storage)).toEqual(DEFAULT_HOME_SETTINGS);
  });

  it("drops unfinished count-based fields during normalization", () => {
    const normalized = normalizeHomeSettings({
      activeLayoutId: "missing-layout",
      customLayouts: [],
      fixedToolCount: 20,
      customShortcutSlots: 12
    });

    expect(normalized.activeLayoutId).toBe(BUILT_IN_CREATIVE_LAYOUT_ID);
    expect(normalized).not.toHaveProperty("fixedToolCount");
    expect(normalized).not.toHaveProperty("customShortcutSlots");
  });

  it("defaults legacy data to visible quick panels and preserves an explicit hidden state", () => {
    expect(
      normalizeHomeSettings({
        activeLayoutId: BUILT_IN_CREATIVE_LAYOUT_ID,
        customLayouts: []
      }).showQuickPanels
    ).toBe(true);

    expect(
      normalizeHomeSettings({
        activeLayoutId: BUILT_IN_CREATIVE_LAYOUT_ID,
        customLayouts: [],
        showQuickPanels: false
      }).showQuickPanels
    ).toBe(false);
  });

  it("repairs invalid custom groups and unknown tool slots", () => {
    const normalized = normalizeHomeSettings({
      activeLayoutId: "custom:test",
      customLayouts: [
        {
          id: "custom:test",
          kind: "custom",
          name: { kind: "custom", value: " 测试布局 " },
          createdAt: "2026-09-24T10:00:00.000Z",
          updatedAt: "2026-09-24T10:00:00.000Z",
          groups: [
            {
              id: "group:one",
              name: { kind: "custom", value: " 第一组 " },
              iconId: "unknown",
              visible: true,
              toolSlots: ["newText", "unknown-tool"]
            }
          ]
        }
      ]
    });

    expect(normalized.activeLayoutId).toBe("custom:test");
    expect(normalized.customLayouts[0].name).toEqual({
      kind: "custom",
      value: "测试布局"
    });
    expect(normalized.customLayouts[0].groups[0].iconId).toBe("folder");
    expect(normalized.customLayouts[0].groups[0].toolSlots).toEqual([
      "newText",
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ]);
  });

  it("migrates the accidental active copy back into the built-in layout without losing edits", () => {
    const accidentalId = "layout:7834600e-8df9-4313-90ed-4f448d9960ea";
    const preservedTools = [
      "newText",
      "star",
      "textLayout",
      "splitText",
      "rectangle",
      "circle",
      "path",
      null
    ];
    const migrated = normalizeHomeSettings({
      activeLayoutId: accidentalId,
      customLayouts: [
        {
          id: accidentalId,
          kind: "custom",
          name: { kind: "custom", value: "创作通用 2" },
          createdAt: "2026-09-25T14:35:51.597Z",
          updatedAt: "2026-09-25T15:08:08.205Z",
          groups: [
            {
              id: `${accidentalId}:group:4`,
              name: { kind: "translation", key: "textShapes" },
              iconId: "text",
              visible: true,
              toolSlots: preservedTools
            }
          ]
        }
      ]
    });

    expect(migrated.activeLayoutId).toBe(BUILT_IN_CREATIVE_LAYOUT_ID);
    expect(migrated.customLayouts).toEqual([]);
    expect(getActiveHomeLayout(migrated).name).toEqual({
      kind: "translation",
      key: "creativeGeneral"
    });
    expect(getActiveHomeLayout(migrated).groups[0].toolSlots).toEqual(
      preservedTools
    );
  });

  it("keeps intentionally named custom layouts separate from the built-in", () => {
    const normalized = normalizeHomeSettings({
      activeLayoutId: "layout:user-created",
      customLayouts: [
        {
          id: "layout:user-created",
          kind: "custom",
          name: { kind: "custom", value: "我的创作通用布局" },
          groups: [
            {
              id: "layout:user-created:group:1",
              name: { kind: "custom", value: "自定义组" },
              iconId: "folder",
              visible: true,
              toolSlots: ["newText"]
            }
          ]
        }
      ]
    });

    expect(normalized.activeLayoutId).toBe("layout:user-created");
    expect(normalized.customLayouts).toHaveLength(1);
    expect(normalized).not.toHaveProperty("builtInLayoutOverride");
  });

  it("upgrades legacy seven-slot groups and compacts tools before padding", () => {
    const normalized = normalizeHomeSettings({
      activeLayoutId: "custom:legacy",
      customLayouts: [
        {
          id: "custom:legacy",
          kind: "custom",
          name: { kind: "custom", value: "Legacy" },
          createdAt: "2026-09-24T10:00:00.000Z",
          updatedAt: "2026-09-24T10:00:00.000Z",
          groups: [
            {
              id: "group:legacy",
              name: { kind: "custom", value: "Legacy Group" },
              iconId: "folder",
              visible: true,
              toolSlots: [
                "newText",
                null,
                "rectangle",
                null,
                null,
                null,
                null
              ]
            }
          ]
        }
      ]
    });

    expect(normalized.customLayouts[0].groups[0].toolSlots).toEqual([
      "newText",
      "rectangle",
      null,
      null,
      null,
      null,
      null,
      null
    ]);
  });

  it("round-trips custom layouts and remembered grid modes", () => {
    const storage = new MemoryStorage();
    const settings = normalizeHomeSettings({
      activeLayoutId: "custom:test",
      showQuickPanels: false,
      rememberPanelModes: true,
      createMode: "select",
      spaceMode: "align",
      defaultCreateMode: "create",
      defaultSpaceMode: "anchor",
      customLayouts: [
        {
          id: "custom:test",
          kind: "custom",
          name: { kind: "custom", value: "测试布局" },
          createdAt: "2026-09-24T10:00:00.000Z",
          updatedAt: "2026-09-24T10:00:00.000Z",
          groups: []
        }
      ]
    });

    writeStoredHomeSettings(settings, storage);

    expect(readStoredHomeSettings(storage)).toEqual(settings);
  });
});
