import { describe, expect, it } from "vitest";
import { createActionRegistry } from "../src/actions/registry";
import { createActionRunner } from "../src/actions/runner";
import { createActionService } from "../src/actions/service";

describe("createActionService", () => {
  it("refreshes context and runs the action exactly once", async () => {
    let snapshots = 0;
    let executions = 0;
    const service = createActionService({
      contextProvider: {
        getSnapshot: async () => {
          snapshots += 1;
          return { hostAvailable: true, activeComp: true, selectedLayers: 1, selectedKeys: 0 };
        }
      },
      runner: createActionRunner({
        registry: createActionRegistry([{
          id: "test.action",
          title: { zhCN: "测试", zhTW: "測試", en: "Test", ja: "テスト", ko: "테스트" },
          icon: "Circle",
          category: "utility",
          requirements: ["host"],
          supportsPie: true,
          execute: { type: "host", command: "test" },
          undoPolicy: "none"
        }]),
        executors: {
          host: async () => {
            executions += 1;
            return { success: true, message: "ok" };
          }
        }
      })
    });
    await expect(service.run("test.action")).resolves.toEqual({ success: true, message: "ok" });
    expect(snapshots).toBe(1);
    expect(executions).toBe(1);
  });

  it("turns an unexpected context-provider failure into a safe unavailable result", async () => {
    const service = createActionService({
      contextProvider: {
        getSnapshot: async () => {
          throw new Error("context failed");
        }
      },
      runner: createActionRunner({
        registry: createActionRegistry([{
          id: "test.action",
          title: { zhCN: "测试", zhTW: "測試", en: "Test", ja: "テスト", ko: "테스트" },
          icon: "Circle",
          category: "utility",
          requirements: ["host"],
          supportsPie: true,
          execute: { type: "host", command: "test" },
          undoPolicy: "none"
        }]),
        executors: {
          host: async () => ({ success: true, message: "unexpected" })
        }
      })
    });

    await expect(service.run("test.action")).resolves.toEqual({
      success: false,
      message: "Action unavailable: host",
      error: { code: "action-unavailable", detail: "host" }
    });
  });

  it("passes runtime alignment options through the runner to the executor", async () => {
    let receivedOptions: unknown;
    const service = createActionService({
      contextProvider: {
        getSnapshot: async () => ({
          hostAvailable: true,
          activeComp: true,
          selectedLayers: 2,
          selectedKeys: 0
        })
      },
      runner: createActionRunner({
        registry: createActionRegistry([{
          id: "layer.align.left",
          title: { zhCN: "左对齐", zhTW: "靠左對齊", en: "Align Left", ja: "左揃え", ko: "왼쪽 맞춤" },
          icon: "BoundingBox",
          category: "layer",
          requirements: ["host", "activeComp", "selectedLayers"],
          supportsPie: true,
          execute: {
            type: "host",
            command: "setAlignment",
            payload: { action: "left", target: "smart" }
          },
          undoPolicy: "host-undo-group"
        }]),
        executors: {
          host: async (_definition, _context, options) => {
            receivedOptions = options;
            return { success: true, message: "ok" };
          }
        }
      })
    });

    await expect(service.run("layer.align.left", {
      alignmentTarget: "composition"
    })).resolves.toEqual({ success: true, message: "ok" });
    expect(receivedOptions).toEqual({ alignmentTarget: "composition" });
  });
});
