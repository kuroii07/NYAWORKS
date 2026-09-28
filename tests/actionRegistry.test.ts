import { describe, expect, it } from "vitest";
import { createActionRegistry } from "../src/actions/registry";
import type { NyaActionDefinition } from "../src/actions/types";

function action(
  id: string,
  supportsPie = true
): NyaActionDefinition {
  return {
    id,
    title: {
      zhCN: id,
      zhTW: id,
      en: id,
      ja: id,
      ko: id
    },
    icon: "Circle",
    category: "utility",
    requirements: [],
    supportsPie,
    execute: {
      type: "internal",
      command: id
    },
    undoPolicy: "none"
  };
}

describe("createActionRegistry", () => {
  it("rejects duplicate action ids", () => {
    expect(() => createActionRegistry([action("duplicate"), action("duplicate")]))
      .toThrow(/duplicate/i);
  });

  it("returns actions by id without changing registration order", () => {
    const registry = createActionRegistry([action("first"), action("second")]);

    expect(registry.get("second")?.id).toBe("second");
    expect(registry.list().map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("only exposes explicitly supported actions to pie consumers", () => {
    const registry = createActionRegistry([
      action("pie-action", true),
      action("panel-only", false)
    ]);

    expect(registry.listPieActions().map((item) => item.id)).toEqual([
      "pie-action"
    ]);
  });
});
