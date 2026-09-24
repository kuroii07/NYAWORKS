import { describe, expect, it } from "vitest";
import {
  hasUnreadReleaseNotes,
  readLastSeenVersion,
  writeLastSeenVersion
} from "../src/updates/releaseNotesStorage";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  shouldThrow = false;

  getItem(key: string): string | null {
    if (this.shouldThrow) {
      throw new Error("storage unavailable");
    }

    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrow) {
      throw new Error("storage unavailable");
    }

    this.values.set(key, value);
  }
}

describe("release notes storage", () => {
  it("reports bundled notes as unread until the current version is seen", () => {
    expect(hasUnreadReleaseNotes("0.1.0-alpha.1", null)).toBe(true);
    expect(
      hasUnreadReleaseNotes("0.1.0-alpha.1", "0.1.0-alpha.1")
    ).toBe(false);
  });

  it("round-trips the last seen release version", () => {
    const storage = new MemoryStorage();

    writeLastSeenVersion("0.1.0-alpha.1", storage);

    expect(readLastSeenVersion(storage)).toBe("0.1.0-alpha.1");
  });

  it("treats malformed and unavailable storage as unseen", () => {
    const storage = new MemoryStorage();
    storage.setItem("nyaworks.updates.lastSeenVersion.v1", "not-a-version");

    expect(readLastSeenVersion(storage)).toBeNull();

    storage.shouldThrow = true;
    expect(readLastSeenVersion(storage)).toBeNull();
    expect(() =>
      writeLastSeenVersion("0.1.0-alpha.1", storage)
    ).not.toThrow();
  });
});
