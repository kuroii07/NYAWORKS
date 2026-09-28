import { describe, expect, it } from "vitest";
import { createCepHostExecutor } from "../src/actions/executors";
import type {
  ActionContextSnapshot,
  NyaActionDefinition
} from "../src/actions/types";

const definition: NyaActionDefinition = {
  id: "p0.direction.top",
  title: {
    zhCN: "上",
    zhTW: "上",
    en: "Top",
    ja: "上",
    ko: "위"
  },
  icon: "ArrowUp",
  category: "utility",
  requirements: ["host"],
  supportsPie: true,
  execute: {
    type: "host",
    command: "runP0TestAction"
  },
  undoPolicy: "none"
};

const context: ActionContextSnapshot = {
  hostAvailable: true,
  activeComp: false,
  selectedLayers: 0,
  selectedKeys: 0
};

describe("createCepHostExecutor", () => {
  it("calls the allowlisted P0 host command and parses its result", async () => {
    let script = "";
    const executor = createCepHostExecutor({
      __adobe_cep__: {
        evalScript(value, callback) {
          script = value;
          callback(
            JSON.stringify({
              ok: true,
              message: "P0 action received",
              data: {
                actionId: "p0.direction.top",
                aeVersion: "25.0"
              }
            })
          );
        }
      }
    });

    await expect(executor(definition, context)).resolves.toEqual({
      success: true,
      message: "P0 action received",
      data: {
        actionId: "p0.direction.top",
        aeVersion: "25.0"
      }
    });
    expect(script).toMatch(/^NYAWORKS\.runP0TestAction\("/);
    expect(decodeURIComponent(script.match(/"([^"]+)"/)?.[1] ?? "")).toBe(
      JSON.stringify({ actionId: "p0.direction.top" })
    );
  });

  it("does not execute host commands outside the P0 allowlist", async () => {
    const executor = createCepHostExecutor({
      __adobe_cep__: {
        evalScript() {
          throw new Error("must not be called");
        }
      }
    });

    await expect(
      executor(
        {
          ...definition,
          execute: {
            type: "host",
            command: "unsafeCommand"
          }
        },
        context
      )
    ).resolves.toEqual({
      success: false,
      message: "Unsupported P0 host command",
      error: {
        code: "unsupported-host-command",
        detail: "unsafeCommand"
      }
    });
  });
});
