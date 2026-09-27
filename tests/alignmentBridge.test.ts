import { describe, expect, it } from "vitest";
import {
  ALIGNMENT_ACTIONS,
  ALIGNMENT_TARGETS,
  createAlignmentHostBridge,
  type AlignmentAction,
  type AlignmentTarget
} from "../src/host/alignmentBridge";

describe("alignment host bridge", () => {
  it("supports six layer actions and three paragraph actions", () => {
    expect(ALIGNMENT_ACTIONS).toEqual([
      "left",
      "center-x",
      "right",
      "top",
      "center-y",
      "bottom",
      "paragraph-left",
      "paragraph-center",
      "paragraph-right"
    ]);
    expect(ALIGNMENT_TARGETS).toEqual(["composition", "selection"]);
  });

  it("encodes the action and target before calling the AE host", async () => {
    let received = "";
    const bridge = createAlignmentHostBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          received = script;
          callback(JSON.stringify({ ok: true, updatedLayers: 3 }));
        }
      }
    });

    await expect(
      bridge.applyAlignment("center-x", "selection")
    ).resolves.toEqual({ ok: true, updatedLayers: 3 });
    expect(received).toMatch(/^NYAWORKS\.setAlignment\(".+"\)$/);
    expect(JSON.parse(decodeURIComponent(received.match(/\("(.+)"\)$/)?.[1] ?? ""))).toEqual({
      action: "center-x",
      target: "selection"
    });
  });

  it("normalizes host errors and unavailable CEP", async () => {
    await expect(
      createAlignmentHostBridge({}).applyAlignment("left", "composition")
    ).resolves.toMatchObject({ ok: false, reason: "unavailable" });

    const bridge = createAlignmentHostBridge({
      __adobe_cep__: {
        evalScript: (_script, callback) =>
          callback(JSON.stringify({ ok: false, reason: "no-text-layer" }))
      }
    });
    await expect(
      bridge.applyAlignment("paragraph-left", "composition")
    ).resolves.toEqual({ ok: false, reason: "no-text-layer" });
  });
});

const _typeCoverage: [AlignmentAction, AlignmentTarget] = ["left", "composition"];
void _typeCoverage;
