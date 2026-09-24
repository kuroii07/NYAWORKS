import { describe, expect, it } from "vitest";
import {
  DENSITY_IDS,
  DEFAULT_DENSITY_ID,
  type DensityId
} from "../src/density/types";
import {
  DENSITY_STORAGE_KEY,
  isDensityId,
  readStoredDensity,
  writeStoredDensity
} from "../src/density/densityStorage";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("interface density preference", () => {
  it("offers the approved large, medium and small sizes", () => {
    expect(DENSITY_IDS).toEqual(["large", "medium", "small"]);
  });

  it("uses medium for the default startup layout", () => {
    expect(DEFAULT_DENSITY_ID).toBe("medium");
    expect(readStoredDensity(new MemoryStorage())).toBe("medium");
  });

  it("ignores an unknown density id", () => {
    const storage = new MemoryStorage();
    storage.setItem(DENSITY_STORAGE_KEY, "extra-large");

    expect(readStoredDensity(storage)).toBe(DEFAULT_DENSITY_ID);
  });

  it("round-trips an approved density id", () => {
    const storage = new MemoryStorage();
    const densityId: DensityId = "small";

    writeStoredDensity(densityId, storage);

    expect(readStoredDensity(storage)).toBe(densityId);
    expect(isDensityId(densityId)).toBe(true);
  });
});
