import { describe, expect, it } from "vitest";
import { createActionContextProvider } from "../src/actions/contextProvider";

describe("createActionContextProvider", () => {
  it("parses a successful host snapshot", async () => {
    const provider = createActionContextProvider({
      evaluate: async () => JSON.stringify({
        ok: true,
        activeComp: true,
        selectedLayers: 2,
        selectedKeys: 0
      })
    });
    await expect(provider.getSnapshot()).resolves.toEqual({
      hostAvailable: true,
      activeComp: true,
      selectedLayers: 2,
      selectedKeys: 0
    });
  });

  it("fails safely for unavailable or invalid host responses", async () => {
    const unavailable = createActionContextProvider({ evaluate: async () => null });
    const invalid = createActionContextProvider({ evaluate: async () => "not-json" });
    await expect(unavailable.getSnapshot()).resolves.toEqual({
      hostAvailable: false,
      activeComp: false,
      selectedLayers: 0,
      selectedKeys: 0
    });
    await expect(invalid.getSnapshot()).resolves.toEqual({
      hostAvailable: false,
      activeComp: false,
      selectedLayers: 0,
      selectedKeys: 0
    });
  });

  it("fails safely when the CEP evaluator rejects", async () => {
    const provider = createActionContextProvider({
      evaluate: async () => {
        throw new Error("CEP bridge failed");
      }
    });

    await expect(provider.getSnapshot()).resolves.toEqual({
      hostAvailable: false,
      activeComp: false,
      selectedLayers: 0,
      selectedKeys: 0
    });
  });
});
