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
  moveToolSlot,
  setToolSlot
} from "../src/homeLayouts/layoutOperations";
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

  it("keeps every group at seven slots while replacing and moving tools", () => {
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
      6
    );

    expect(moved.customLayouts[0].groups[0].toolSlots).toHaveLength(7);
    expect(moved.customLayouts[0].groups[0].toolSlots[0]).toBeNull();
    expect(moved.customLayouts[0].groups[0].toolSlots[6]).toBe("newText");
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
});
