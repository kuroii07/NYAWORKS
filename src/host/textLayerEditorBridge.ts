import { evaluateHostScript, type CepEnvironment } from "./cepBridge";

export type TextLayerEditorFailureReason =
  | "unavailable"
  | "invalid-host-response"
  | "no-active-comp"
  | "invalid-selection"
  | "unsupported-layer-type"
  | "empty-text"
  | "invalid-target"
  | "host-error";

export type ReadTextLayerResult =
  | { ok: true; text: string; layerName: string; targetId: string }
  | { ok: false; reason: TextLayerEditorFailureReason; detail?: string };

export type WriteTextLayerResult =
  | { ok: true; createdLayers: number; updatedLayers: number }
  | { ok: false; reason: TextLayerEditorFailureReason; detail?: string };

export interface TextLayerEditorBridge {
  readSelectedTextLayer(): Promise<ReadTextLayerResult>;
  applyText(targetId: string, text: string): Promise<WriteTextLayerResult>;
  createText(text: string): Promise<WriteTextLayerResult>;
}

const FAILURE_REASONS: readonly TextLayerEditorFailureReason[] = [
  "no-active-comp",
  "invalid-selection",
  "unsupported-layer-type",
  "empty-text",
  "invalid-target",
  "host-error"
];

function encodePayload(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function parseFailure(value: Record<string, unknown>) {
  const reason = FAILURE_REASONS.find((candidate) => value.reason === candidate);
  return {
    ok: false as const,
    reason: reason ?? "host-error" as TextLayerEditorFailureReason,
    detail: typeof value.detail === "string" ? value.detail : undefined
  };
}

function parseReadResult(value: string | null): ReadTextLayerResult {
  if (value === null) return { ok: false, reason: "unavailable" };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      parsed.ok === true &&
      typeof parsed.text === "string" &&
      typeof parsed.layerName === "string" &&
      typeof parsed.targetId === "string"
    ) {
      return {
        ok: true,
        text: parsed.text,
        layerName: parsed.layerName,
        targetId: parsed.targetId
      };
    }
    return parseFailure(parsed);
  } catch {
    return { ok: false, reason: "invalid-host-response" };
  }
}

function parseWriteResult(value: string | null): WriteTextLayerResult {
  if (value === null) return { ok: false, reason: "unavailable" };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.ok === true) {
      return {
        ok: true,
        createdLayers:
          typeof parsed.createdLayers === "number" ? parsed.createdLayers : 0,
        updatedLayers:
          typeof parsed.updatedLayers === "number" ? parsed.updatedLayers : 0
      };
    }
    return parseFailure(parsed);
  } catch {
    return { ok: false, reason: "invalid-host-response" };
  }
}

export function createTextLayerEditorBridge(
  environment?: CepEnvironment
): TextLayerEditorBridge {
  return {
    async readSelectedTextLayer() {
      return parseReadResult(
        await evaluateHostScript("NYAWORKS.readSelectedTextLayer()", environment)
      );
    },
    async applyText(targetId, text) {
      return parseWriteResult(
        await evaluateHostScript(
          `NYAWORKS.applyTextLayerEdit("${encodePayload({ targetId, text })}")`,
          environment
        )
      );
    },
    async createText(text) {
      return parseWriteResult(
        await evaluateHostScript(
          `NYAWORKS.createTextLayerFromEditor("${encodePayload({ text })}")`,
          environment
        )
      );
    }
  };
}

export const textLayerEditorBridge = createTextLayerEditorBridge();
