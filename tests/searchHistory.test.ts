import { describe, expect, it } from "vitest";
import {
  buildRecentRanks,
  readSearchHistory,
  recordSearchHistory
} from "../src/search/searchHistory";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("global search history", () => {
  it("records unique recent items with newest first and a bounded size", () => {
    const storage = new MemoryStorage();
    for (let index = 0; index < 14; index += 1) {
      recordSearchHistory(`item-${index}`, storage);
    }
    recordSearchHistory("item-5", storage);

    const history = readSearchHistory(storage);
    expect(history[0]).toBe("item-5");
    expect(history).toHaveLength(12);
    expect(new Set(history).size).toBe(12);
  });

  it("builds deterministic rank values for recent items", () => {
    expect(buildRecentRanks(["b", "a"])).toEqual(new Map([
      ["b", 0],
      ["a", 1]
    ]));
  });
});
