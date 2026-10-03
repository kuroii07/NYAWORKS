import { describe, expect, it } from "vitest";
import {
  moveResourceSelection,
  reconcileFilteredSelection,
  reconcileRefreshedSelection,
  type ResourceSelectionState
} from "../src/resources/resourceSelection";

const empty: ResourceSelectionState = {
  selectedResourceId: null,
  focusedResourceId: null
};

const ids = ["one", "two", "three"];

describe("resource selection movement", () => {
  it("enters an unselected list from the directionally nearest edge", () => {
    expect(moveResourceSelection(empty, ids, "next")).toEqual({
      selectedResourceId: "one",
      focusedResourceId: "one"
    });
    expect(moveResourceSelection(empty, ids, "previous")).toEqual({
      selectedResourceId: "three",
      focusedResourceId: "three"
    });
  });

  it("moves one row and stops at the list edges", () => {
    const middle = { selectedResourceId: "two", focusedResourceId: "two" };
    expect(moveResourceSelection(middle, ids, "previous").selectedResourceId).toBe("one");
    expect(moveResourceSelection(middle, ids, "next").selectedResourceId).toBe("three");
    expect(
      moveResourceSelection(
        { selectedResourceId: "one", focusedResourceId: "one" },
        ids,
        "previous"
      ).selectedResourceId
    ).toBe("one");
    expect(
      moveResourceSelection(
        { selectedResourceId: "three", focusedResourceId: "three" },
        ids,
        "next"
      ).selectedResourceId
    ).toBe("three");
  });

  it("moves directly to the first or last row", () => {
    const middle = { selectedResourceId: "two", focusedResourceId: "two" };
    expect(moveResourceSelection(middle, ids, "first").selectedResourceId).toBe("one");
    expect(moveResourceSelection(middle, ids, "last").selectedResourceId).toBe("three");
  });

  it.each(["previous", "next", "first", "last"] as const)(
    "keeps an empty list empty for %s",
    (direction) => {
      expect(moveResourceSelection(
        { selectedResourceId: "stale", focusedResourceId: "stale" },
        [],
        direction
      )).toEqual(empty);
    }
  );
});

describe("resource selection reconciliation", () => {
  it("clears a selection hidden by filtering", () => {
    expect(reconcileFilteredSelection(
      { selectedResourceId: "two", focusedResourceId: "two" },
      ["one", "three"]
    )).toEqual(empty);
  });

  it("keeps a visible selection after filtering", () => {
    const selected = { selectedResourceId: "two", focusedResourceId: "two" };
    expect(reconcileFilteredSelection(selected, ["two", "three"])).toEqual(selected);
  });

  it("selects the replacement at the removed resource index after refresh", () => {
    expect(reconcileRefreshedSelection(
      { selectedResourceId: "two", focusedResourceId: "two" },
      ["one", "two", "three"],
      ["one", "replacement", "three"]
    )).toEqual({
      selectedResourceId: "replacement",
      focusedResourceId: "replacement"
    });
  });

  it("uses the new last row when the former index is out of range", () => {
    expect(reconcileRefreshedSelection(
      { selectedResourceId: "three", focusedResourceId: "three" },
      ["one", "two", "three"],
      ["one", "two"]
    )).toEqual({ selectedResourceId: "two", focusedResourceId: "two" });
  });

  it("clears selection when refresh leaves no resources", () => {
    expect(reconcileRefreshedSelection(
      { selectedResourceId: "two", focusedResourceId: "two" },
      ids,
      []
    )).toEqual(empty);
  });

  it("keeps the same selected resource when refresh reorders it", () => {
    const selected = { selectedResourceId: "two", focusedResourceId: "two" };
    expect(reconcileRefreshedSelection(selected, ids, ["three", "two", "one"])).toEqual(
      selected
    );
  });
});
