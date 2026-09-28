import { describe, expect, it } from "vitest";
import { createActionRegistry } from "../src/actions/registry";
import { createActionRunner } from "../src/actions/runner";
import type {
  ActionContextSnapshot,
  ActionExecutor,
  NyaActionDefinition
} from "../src/actions/types";

const baseContext: ActionContextSnapshot = {
  hostAvailable: true,
  activeComp: true,
  selectedLayers: 1,
  selectedKeys: 0
};

function hostAction(
  requirements: NyaActionDefinition["requirements"] = []
): NyaActionDefinition {
  return {
    id: "p0.test",
    title: {
      zhCN: "P0 测试",
      zhTW: "P0 測試",
      en: "P0 Test",
      ja: "P0 テスト",
      ko: "P0 테스트"
    },
    icon: "Circle",
    category: "utility",
    requirements,
    supportsPie: true,
    execute: {
      type: "host",
      command: "runP0TestAction"
    },
    undoPolicy: "none"
  };
}

describe("createActionRunner", () => {
  it("returns a structured error for an unknown action", async () => {
    const runner = createActionRunner({
      registry: createActionRegistry([]),
      executors: {}
    });

    await expect(runner.run("missing", baseContext)).resolves.toEqual({
      success: false,
      message: "Unknown action: missing",
      error: {
        code: "unknown-action"
      }
    });
  });

  it("does not execute an action whose context requirements are unavailable", async () => {
    let calls = 0;
    const executor: ActionExecutor = async () => {
      calls += 1;
      return { success: true, message: "unexpected" };
    };
    const runner = createActionRunner({
      registry: createActionRegistry([hostAction(["selectedLayers"])]),
      executors: { host: executor }
    });

    const result = await runner.run("p0.test", {
      ...baseContext,
      selectedLayers: 0
    });

    expect(calls).toBe(0);
    expect(result).toEqual({
      success: false,
      message: "Action unavailable: selectedLayers",
      error: {
        code: "action-unavailable",
        detail: "selectedLayers"
      }
    });
  });

  it("passes the definition and context to the matching executor", async () => {
    const executor: ActionExecutor = async (definition, context) => ({
      success: true,
      message: `${definition.id}:${context.selectedLayers}`,
      data: { command: definition.execute.command }
    });
    const runner = createActionRunner({
      registry: createActionRegistry([hostAction()]),
      executors: { host: executor }
    });

    await expect(runner.run("p0.test", baseContext)).resolves.toEqual({
      success: true,
      message: "p0.test:1",
      data: {
        command: "runP0TestAction"
      }
    });
  });

  it("normalizes executor failures into ActionResult", async () => {
    const executor: ActionExecutor = async () => {
      throw new Error("bridge failed");
    };
    const runner = createActionRunner({
      registry: createActionRegistry([hostAction()]),
      executors: { host: executor }
    });

    await expect(runner.run("p0.test", baseContext)).resolves.toEqual({
      success: false,
      message: "Action execution failed",
      error: {
        code: "executor-error",
        detail: "bridge failed"
      }
    });
  });
});
