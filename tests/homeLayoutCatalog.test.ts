import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CREATIVE_LAYOUT_ID,
  BUILT_IN_HOME_LAYOUTS,
  HOME_GROUP_SLOT_COUNT
} from "../src/homeLayouts/catalog";

describe("home layout catalog", () => {
  it("defines five built-in groups with seven tools and one trailing add slot", () => {
    const layout = BUILT_IN_HOME_LAYOUTS.find(
      (item) => item.id === BUILT_IN_CREATIVE_LAYOUT_ID
    );

    expect(layout?.kind).toBe("built-in");
    expect(layout?.groups).toHaveLength(5);
    expect(
      layout?.groups.every(
        (group) => group.toolSlots.length === HOME_GROUP_SLOT_COUNT
      )
    ).toBe(true);
    expect(
      layout?.groups.every(
        (group) =>
          group.toolSlots.slice(0, 7).every(Boolean) &&
          group.toolSlots[7] === null
      )
    ).toBe(true);
  });
});
