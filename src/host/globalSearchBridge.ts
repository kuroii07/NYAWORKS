import { evaluateHostScript, type CepEnvironment } from "./cepBridge";

export interface HostEffectItem {
  id: string;
  name: string;
  matchName: string;
  aliases: string[];
}

export interface CurrentAeEffectsResult {
  status: "connected" | "unavailable" | "error";
  effects: HostEffectItem[];
  isDevelopmentFixture: boolean;
}

export type GlobalSearchHostAction =
  | { action: "run-script"; path: string }
  | { action: "apply-preset"; path: string }
  | { action: "add-effect"; matchName: string };

export type GlobalSearchActionResult =
  | { ok: true }
  | { ok: false; reason: string; detail?: string };

export interface GlobalSearchHostBridge {
  readCurrentAeEffects(): Promise<CurrentAeEffectsResult>;
  executeGlobalSearchAction(action: GlobalSearchHostAction): Promise<GlobalSearchActionResult>;
}

const unavailable: CurrentAeEffectsResult = {
  status: "unavailable",
  effects: [],
  isDevelopmentFixture: false
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(value: string | null): unknown | null {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeEffect(value: unknown): HostEffectItem | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim() || typeof value.matchName !== "string" || !value.matchName.trim()) {
    return null;
  }
  const aliases = Array.isArray(value.aliases)
    ? value.aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
    : [];
  return {
    id: typeof value.id === "string" && value.id ? value.id : `effect:${value.matchName}`,
    name: value.name.trim(),
    matchName: value.matchName.trim(),
    aliases
  };
}

function encodedPayload(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function parseActionResult(value: string | null): GlobalSearchActionResult {
  if (value === null) return { ok: false, reason: "unavailable" };
  const parsed = parseJson(value);
  if (!isRecord(parsed) || parsed.ok !== true) {
    const reason = isRecord(parsed) && parsed.reason === "no-selected-layer"
      ? "no-selected-layer"
      : isRecord(parsed) && parsed.reason === "invalid-resource"
        ? "invalid-resource"
        : "host-error";
    return { ok: false, reason };
  }
  return { ok: true };
}

export function createGlobalSearchHostBridge(environment?: CepEnvironment): GlobalSearchHostBridge {
  return {
    async readCurrentAeEffects() {
      const result = await evaluateHostScript("NYAWORKS.getCurrentEffects()", environment);
      if (result === null) return unavailable;
      const parsed = parseJson(result);
      if (!isRecord(parsed) || parsed.ok !== true || !Array.isArray(parsed.effects)) {
        return { ...unavailable, status: "error" };
      }
      return {
        status: "connected",
        effects: parsed.effects.map(normalizeEffect).filter((effect): effect is HostEffectItem => effect !== null),
        isDevelopmentFixture: false
      };
    },
    async executeGlobalSearchAction(action) {
      let script: string;
      if (action.action === "run-script") {
        script = `NYAWORKS.runSearchScript("${encodedPayload({ path: action.path })}")`;
      } else if (action.action === "apply-preset") {
        script = `NYAWORKS.applySearchPreset("${encodedPayload({ path: action.path })}")`;
      } else {
        script = `NYAWORKS.addSearchEffect("${encodedPayload({ matchName: action.matchName })}")`;
      }
      return parseActionResult(await evaluateHostScript(script, environment));
    }
  };
}

export const globalSearchHostBridge = createGlobalSearchHostBridge();
