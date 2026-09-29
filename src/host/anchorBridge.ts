import { evaluateHostScript, type CepEnvironment } from "./cepBridge";
import {
  ANCHOR_POSITIONS,
  type AnchorPosition
} from "../actions/anchorTypes";

export { ANCHOR_POSITIONS };
export type { AnchorPosition };

export interface LayerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type AnchorActionResult =
  | { ok: true; updatedLayers: number; threeDLayers: number }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "invalid-host-response"
        | "host-error"
        | "no-selected-layer"
        | "locked-layer"
        | "unsupported-layer"
        | "expression-conflict";
      detail?: string;
    };

export interface AnchorHostBridge {
  setAnchorPoint(position: AnchorPosition): Promise<AnchorActionResult>;
}

const POSITION_FRACTIONS: Record<AnchorPosition, { x: number; y: number }> = {
  "top-left": { x: 0, y: 0 },
  top: { x: 0.5, y: 0 },
  "top-right": { x: 1, y: 0 },
  left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 1, y: 0.5 },
  "bottom-left": { x: 0, y: 1 },
  bottom: { x: 0.5, y: 1 },
  "bottom-right": { x: 1, y: 1 }
};

export function calculateAnchorPoint(
  position: AnchorPosition,
  bounds: LayerBounds,
  z = 0
): [number, number, number] {
  const fraction = POSITION_FRACTIONS[position];
  return [
    bounds.left + bounds.width * fraction.x,
    bounds.top + bounds.height * fraction.y,
    z
  ];
}

function encodedPayload(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function parseResult(value: string | null): AnchorActionResult {
  if (value === null) {
    return {
      ok: false,
      reason: "unavailable",
      detail: "当前是浏览器预览，不能调用 AE；请在 AE 的“窗口 > 扩展”中打开 NYAWORKS"
    };
  }

  console.warn("NYAWORKS anchor host raw result", value);

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.ok === true) {
      return {
        ok: true,
        updatedLayers: typeof parsed.updatedLayers === "number" ? parsed.updatedLayers : 0,
        threeDLayers: typeof parsed.threeDLayers === "number" ? parsed.threeDLayers : 0
      };
    }

    const reasons = [
      "no-selected-layer",
      "locked-layer",
      "unsupported-layer",
      "expression-conflict"
    ] as const;
    const reason = reasons.find((candidate) => parsed.reason === candidate);
    return {
      ok: false,
      reason: reason ?? "host-error",
      detail: typeof parsed.detail === "string" ? parsed.detail : undefined
    };
  } catch {
    return { ok: false, reason: "invalid-host-response" };
  }
}

export function createAnchorHostBridge(environment?: CepEnvironment): AnchorHostBridge {
  return {
    async setAnchorPoint(position) {
      return parseResult(
        await evaluateHostScript(
          `NYAWORKS.setAnchorPoint("${encodedPayload({ position })}")`,
          environment
        )
      );
    }
  };
}

export const anchorHostBridge = createAnchorHostBridge();
