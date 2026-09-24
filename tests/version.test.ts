import { describe, expect, it } from "vitest";
import {
  compareVersions,
  normalizeVersionTag
} from "../src/updates/version";

describe("release version comparison", () => {
  it("compares prerelease increments", () => {
    expect(compareVersions("0.1.0-alpha.1", "v0.1.0-alpha.2")).toBe(-1);
  });

  it("treats identical stable versions as equal", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("sorts a stable release above its prerelease", () => {
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBe(1);
  });

  it("returns an equal non-updating result for invalid input", () => {
    expect(compareVersions("invalid", "1.0.0")).toBe(0);
    expect(normalizeVersionTag("invalid")).toBeNull();
  });
});
