import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CREATIVE_LAYOUT_ID,
  BUILT_IN_HOME_LAYOUTS
} from "../src/homeLayouts/catalog";
import {
  createCustomLayout,
  deleteLayout,
  duplicateLayout,
  isDuplicateLayoutName,
  moveLayoutGroup,
  moveToolBetweenGroups,
  moveToolSlot,
  setToolSlot
} from "../src/homeLayouts/layoutOperations";
import { normalizeHomeSettings } from "../src/settings/homeSettingsStorage";
import { DEFAULT_HOME_SETTINGS } from "../src/settings/types";

describe("home layout operations", () => {
  it("creates a named custom copy without mutating the built-in layout", () => {
    const next = duplicateLayout(
      DEFAULT_HOME_SETTINGS,
      BUILT_IN_CREATIVE_LAYOUT_ID,
      {
        id: "custom:motion",
        name: "  MG 动画  ",
        now: "2026-09-24T10:00:00.000Z"
      }
    );

    expect(next.activeLayoutId).toBe("custom:motion");
    expect(next.customLayouts[0].name).toEqual({
      kind: "custom",
      value: "MG 动画"
    });
    expect(next.customLayouts[0].groups).toHaveLength(5);
    expect(BUILT_IN_HOME_LAYOUTS[0].kind).toBe("built-in");
  });

  it("deleting the active custom layout returns to the built-in layout", () => {
    const created = createCustomLayout(DEFAULT_HOME_SETTINGS, {
      id: "custom:blank",
      name: "空白",
      source: "blank",
      blankGroupId: "group:first",
      blankGroupName: "工具组 1",
      now: "2026-09-24T10:00:00.000Z"
    });

    expect(deleteLayout(created, "custom:blank").activeLayoutId).toBe(
      BUILT_IN_CREATIVE_LAYOUT_ID
    );
  });

  it("rejects duplicate names after trimming and case folding", () => {
    const created = createCustomLayout(DEFAULT_HOME_SETTINGS, {
      id: "custom:first",
      name: "Motion",
      source: "blank",
      blankGroupId: "group:first",
      blankGroupName: "Group 1",
      now: "2026-09-24T10:00:00.000Z"
    });

    expect(isDuplicateLayoutName(created, " motion ")).toBe(true);
  });

  it("keeps every group at eight compact slots while replacing and moving tools", () => {
    const created = createCustomLayout(DEFAULT_HOME_SETTINGS, {
      id: "custom:test",
      name: "测试",
      source: "blank",
      blankGroupId: "group:first",
      blankGroupName: "工具组 1",
      now: "2026-09-24T10:00:00.000Z"
    });
    const replaced = setToolSlot(
      created,
      "custom:test",
      "group:first",
      0,
      "newText"
    );
    const moved = moveToolSlot(
      replaced,
      "custom:test",
      "group:first",
      0,
      7
    );

    expect(moved.customLayouts[0].groups[0].toolSlots).toEqual([
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

  it("removing a tool compacts later tools and leaves add slots at the end", () => {
    const created = duplicateLayout(
      DEFAULT_HOME_SETTINGS,
      BUILT_IN_CREATIVE_LAYOUT_ID,
      {
        id: "custom:compact",
        name: "Compact",
        now: "2026-09-24T10:00:00.000Z"
      }
    );
    const groupId = created.customLayouts[0].groups[0].id;
    const removed = setToolSlot(
      created,
      "custom:compact",
      groupId,
      2,
      null
    );
    const slots = removed.customLayouts[0].groups[0].toolSlots;

    expect(slots).toHaveLength(8);
    expect(slots.slice(0, 6)).toEqual([
      "newProjectFolder",
      "organizeProject",
      "packageLayers",
      "fitComp",
      "findFootage",
      "removeUnused"
    ]);
    expect(slots.slice(6)).toEqual([null, null]);
  });

  it("moves a tool between groups and compacts both groups", () => {
    const created = duplicateLayout(
      DEFAULT_HOME_SETTINGS,
      BUILT_IN_CREATIVE_LAYOUT_ID,
      {
        id: "custom:cross-group",
        name: "Cross Group",
        now: "2026-09-24T10:00:00.000Z"
      }
    );
    const [sourceGroup, targetGroup] = created.customLayouts[0].groups;
    const moved = moveToolBetweenGroups(
      created,
      "custom:cross-group",
      sourceGroup.id,
      0,
      targetGroup.id,
      2
    );
    const [nextSource, nextTarget] = moved.customLayouts[0].groups;

    expect(nextSource.toolSlots).toEqual([
      "organizeProject",
      "duplicateComp",
      "packageLayers",
      "fitComp",
      "findFootage",
      "removeUnused",
      null,
      null
    ]);
    expect(nextTarget.toolSlots).toEqual([
      "duplicateLayer",
      "linkParent",
      "newProjectFolder",
      "unlinkParent",
      "moveUp",
      "moveDown",
      "reverseOrder",
      "soloLayers"
    ]);
  });

  it("rejects a cross-group move when the target already has eight tools", () => {
    const created = duplicateLayout(
      DEFAULT_HOME_SETTINGS,
      BUILT_IN_CREATIVE_LAYOUT_ID,
      {
        id: "custom:full-target",
        name: "Full Target",
        now: "2026-09-24T10:00:00.000Z"
      }
    );
    const [sourceGroup, targetGroup] = created.customLayouts[0].groups;
    const filled = setToolSlot(
      created,
      "custom:full-target",
      targetGroup.id,
      7,
      "camera"
    );
    const moved = moveToolBetweenGroups(
      filled,
      "custom:full-target",
      sourceGroup.id,
      0,
      targetGroup.id,
      3
    );

    expect(moved).toBe(filled);
  });

  it("moves a group down to the adjacent target position", () => {
    const created = duplicateLayout(
      DEFAULT_HOME_SETTINGS,
      BUILT_IN_CREATIVE_LAYOUT_ID,
      {
        id: "custom:reorder",
        name: "Reorder",
        now: "2026-09-24T10:00:00.000Z"
      }
    );
    const [first, second] = created.customLayouts[0].groups;
    const moved = moveLayoutGroup(
      created,
      "custom:reorder",
      first.id,
      second.id
    );

    expect(moved.customLayouts[0].groups.slice(0, 2).map((group) => group.id))
      .toEqual([second.id, first.id]);
  });

  it("keeps copied group ids unique after repeated copies and storage normalization", () => {
    const first = duplicateLayout(
      DEFAULT_HOME_SETTINGS,
      BUILT_IN_CREATIVE_LAYOUT_ID,
      {
        id: "layout:11111111-1111-4111-8111-111111111111",
        name: "First",
        now: "2026-09-24T10:00:00.000Z"
      }
    );
    const second = duplicateLayout(
      first,
      first.activeLayoutId,
      {
        id: "layout:22222222-2222-4222-8222-222222222222",
        name: "Second",
        now: "2026-09-24T10:01:00.000Z"
      }
    );
    const restored = normalizeHomeSettings(
      JSON.parse(JSON.stringify(second))
    );
    const copiedGroups = restored.customLayouts[1].groups;

    expect(copiedGroups).toHaveLength(5);
    expect(new Set(copiedGroups.map((group) => group.id)).size).toBe(5);
    expect(copiedGroups.every((group) => group.id.length <= 80)).toBe(true);
  });
});
