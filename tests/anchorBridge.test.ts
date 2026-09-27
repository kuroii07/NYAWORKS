import { describe, expect, it } from "vitest";
import {
  ANCHOR_POSITIONS,
  calculateAnchorPoint,
  createAnchorHostBridge,
  type AnchorPosition
} from "../src/host/anchorBridge";

describe("anchor geometry", () => {
  it("maps all nine positions to the layer bounds", () => {
    const bounds = { left: -40, top: 20, width: 200, height: 100 };
    const expected: Record<AnchorPosition, [number, number]> = {
      "top-left": [-40, 20],
      top: [60, 20],
      "top-right": [160, 20],
      left: [-40, 70],
      center: [60, 70],
      right: [160, 70],
      "bottom-left": [-40, 120],
      bottom: [60, 120],
      "bottom-right": [160, 120]
    };

    expect(ANCHOR_POSITIONS).toHaveLength(9);
    for (const position of ANCHOR_POSITIONS) {
      expect(calculateAnchorPoint(position, bounds, 17)).toEqual([
        expected[position][0],
        expected[position][1],
        17
      ]);
    }
  });
});

describe("anchor host bridge", () => {
  it("encodes the selected position before calling the AE host", async () => {
    let received = "";
    const bridge = createAnchorHostBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          received = script;
          callback(JSON.stringify({ ok: true, updatedLayers: 2, threeDLayers: 1 }));
        }
      }
    });

    await expect(bridge.setAnchorPoint("bottom-right")).resolves.toEqual({
      ok: true,
      updatedLayers: 2,
      threeDLayers: 1
    });
    expect(received).toMatch(/^NYAWORKS\.setAnchorPoint\(".+"\)$/);
    expect(JSON.parse(decodeURIComponent(received.match(/\("(.+)"\)$/)?.[1] ?? ""))).toEqual({
      position: "bottom-right"
    });
  });

  it("normalizes host errors and unavailable CEP", async () => {
    await expect(createAnchorHostBridge({}).setAnchorPoint("center")).resolves.toMatchObject({
      ok: false,
      reason: "unavailable"
    });

    const bridge = createAnchorHostBridge({
      __adobe_cep__: {
        evalScript: (_script, callback) => callback(JSON.stringify({
          ok: false,
          reason: "no-selected-layer"
        }))
      }
    });
    await expect(bridge.setAnchorPoint("center")).resolves.toEqual({
      ok: false,
      reason: "no-selected-layer"
    });
  });
});
