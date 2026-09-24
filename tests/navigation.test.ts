import { describe, expect, it } from "vitest";
import { PAGE_IDS } from "../src/types/navigation";

describe("top bar navigation", () => {
  it("provides a dedicated settings page target", () => {
    expect(PAGE_IDS).toContain("settings");
  });
});
