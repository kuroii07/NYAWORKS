export interface LocalizedActionText {
  zhCN: string;
  zhTW: string;
  en: string;
  ja: string;
  ko: string;
}

export type ActionCategory =
  | "layer"
  | "animation"
  | "composition"
  | "camera"
  | "text"
  | "shape"
  | "effect"
  | "utility";

export type ActionRequirement =
  | "host"
  | "activeComp"
  | "selectedLayers"
  | "selectedKeys";

export interface ActionExecutionDescriptor {
  type: "host" | "internal";
  command: string;
  payload?: unknown;
}

export interface NyaActionDefinition {
  id: string;
  title: LocalizedActionText;
  description?: LocalizedActionText;
  icon: string;
  category: ActionCategory;
  requirements: readonly ActionRequirement[];
  supportsPie: boolean;
  execute: ActionExecutionDescriptor;
  undoPolicy: "none" | "host-undo-group";
}

export interface ActionAvailability {
  enabled: boolean;
  reason?: ActionRequirement;
}

export interface ActionError {
  code: string;
  detail?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: ActionError;
}

export interface ActionContextSnapshot {
  hostAvailable: boolean;
  activeComp: boolean;
  selectedLayers: number;
  selectedKeys: number;
}

export type ActionExecutor = (
  definition: NyaActionDefinition,
  context: ActionContextSnapshot
) => Promise<ActionResult>;
