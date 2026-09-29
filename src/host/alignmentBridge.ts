import { evaluateHostScript, type CepEnvironment } from "./cepBridge";
import type {
  AlignmentAction,
  AlignmentTarget
} from "../actions/alignmentTypes";

export {
  ALIGNMENT_ACTIONS,
  ALIGNMENT_TARGETS,
  type AlignmentAction,
  type AlignmentTarget
} from "../actions/alignmentTypes";

export type AlignmentActionResult =
  | { ok: true; updatedLayers: number }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "host-error"
        | "no-selected-layer"
        | "no-text-layer"
        | "locked-layer"
        | "unsupported-layer"
        | "expression-conflict";
      detail?: string;
    };

export interface AlignmentHostBridge {
  applyAlignment(
    action: AlignmentAction,
    target: AlignmentTarget
  ): Promise<AlignmentActionResult>;
}

function encodedPayload(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function parseResult(value: string | null): AlignmentActionResult {
  if (value === null) {
    return {
      ok: false,
      reason: "unavailable",
      detail: "当前是浏览器预览，不能调用 AE；请在 AE 的“窗口 > 扩展”中打开 NYAWORKS"
    };
  }

  console.warn("NYAWORKS alignment host raw result", value);

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.ok === true) {
      return {
        ok: true,
        updatedLayers:
          typeof parsed.updatedLayers === "number" ? parsed.updatedLayers : 0
      };
    }

    const reasons = [
      "no-selected-layer",
      "no-text-layer",
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
    return { ok: false, reason: "host-error" };
  }
}

export function createAlignmentHostBridge(
  environment?: CepEnvironment
): AlignmentHostBridge {
  return {
    async applyAlignment(action, target) {
      return parseResult(
        await evaluateHostScript(
          `NYAWORKS.setAlignment("${encodedPayload({ action, target })}")`,
          environment
        )
      );
    }
  };
}

export const alignmentHostBridge = createAlignmentHostBridge();
