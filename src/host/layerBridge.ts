import { evaluateHostScript, getCepExtensionRoot, type CepEnvironment } from "./cepBridge";
import type {
  LayerAction,
  LayerActionModifier
} from "../actions/layerActionTypes";

export type LayerHostFailureReason =
  | "unavailable"
  | "invalid-host-response"
  | "no-active-comp"
  | "no-selected-layer"
  | "invalid-selection"
  | "unsupported-layer-type"
  | "unsupported-precomp"
  | "unsafe-unprecompose"
  | "host-error";

export type LayerHostActionResult =
  | {
      ok: true;
      createdLayers: number;
      updatedLayers: number;
      createdItems: number;
    }
  | {
      ok: false;
      reason: LayerHostFailureReason;
      detail?: string;
    };

export interface LayerHostBridge {
  runLayerAction(
    action: LayerAction,
    modifier: LayerActionModifier
  ): Promise<LayerHostActionResult>;
}

const HOST_FAILURE_REASONS: readonly LayerHostFailureReason[] = [
  "no-active-comp",
  "no-selected-layer",
  "invalid-selection",
  "unsupported-layer-type",
  "unsupported-precomp",
  "unsafe-unprecompose",
  "host-error"
];

function encodedPayload(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function numericCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseResult(value: string | null): LayerHostActionResult {
  if (value === null) {
    return {
      ok: false,
      reason: "unavailable",
      detail: "当前是浏览器预览，不能调用 AE；请在 AE 的“窗口 > 扩展”中打开 NYAWORKS"
    };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.ok === true) {
      return {
        ok: true,
        createdLayers: numericCount(parsed.createdLayers),
        updatedLayers: numericCount(parsed.updatedLayers),
        createdItems: numericCount(parsed.createdItems)
      };
    }

    const reason = HOST_FAILURE_REASONS.find(
      (candidate) => parsed.reason === candidate
    );
    return {
      ok: false,
      reason: reason ?? "host-error",
      detail: typeof parsed.detail === "string" ? parsed.detail : undefined
    };
  } catch {
    return { ok: false, reason: "invalid-host-response" };
  }
}

export function createLayerHostBridge(
  environment?: CepEnvironment
): LayerHostBridge {
  return {
    async runLayerAction(action, modifier) {
      const pseudoShape = action === "create-shape" && (modifier === "none" || modifier === "alt");
      const extensionRoot = pseudoShape ? getCepExtensionRoot(environment) : null;
      if (pseudoShape && !extensionRoot) {
        return { ok: false, reason: "host-error", detail: "pseudo-extension-root-unavailable" };
      }
      return parseResult(
        await evaluateHostScript(
          `NYAWORKS.runLayerAction("${encodedPayload(
            extensionRoot ? { action, modifier, extensionRoot } : { action, modifier }
          )}")`,
          environment
        )
      );
    }
  };
}

export const layerHostBridge = createLayerHostBridge();
