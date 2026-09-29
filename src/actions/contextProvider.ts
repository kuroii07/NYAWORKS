import { evaluateHostScript, type CepEnvironment } from "../host/cepBridge";
import type { ActionContextProvider } from "./service";
import type { ActionContextSnapshot } from "./types";

const EMPTY_CONTEXT: ActionContextSnapshot = {
  hostAvailable: false,
  activeComp: false,
  selectedLayers: 0,
  selectedKeys: 0
};

export function createActionContextProvider(options: {
  evaluate?: (script: string) => Promise<string | null>;
  environment?: CepEnvironment;
} = {}): ActionContextProvider {
  const evaluate = options.evaluate ?? ((script: string) =>
    evaluateHostScript(script, options.environment));
  return {
    async getSnapshot() {
      try {
        const raw = await evaluate("NYAWORKS.getActionContext()");
        if (raw === null) return { ...EMPTY_CONTEXT };
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.ok !== true) return { ...EMPTY_CONTEXT };
        return {
          hostAvailable: true,
          activeComp: parsed.activeComp === true,
          selectedLayers: typeof parsed.selectedLayers === "number" ? parsed.selectedLayers : 0,
          selectedKeys: typeof parsed.selectedKeys === "number" ? parsed.selectedKeys : 0
        };
      } catch {
        return { ...EMPTY_CONTEXT };
      }
    }
  };
}
