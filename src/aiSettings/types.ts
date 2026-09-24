export const BUILT_IN_AI_PROVIDER_IDS = [
  "openai",
  "claude",
  "gemini",
  "deepseek",
  "qwen",
  "doubao",
  "kimi",
  "zhipu"
] as const;

export type BuiltInAiProviderId =
  (typeof BUILT_IN_AI_PROVIDER_IDS)[number];

export type AiProviderId = BuiltInAiProviderId | "openai-compatible";

export type AiVerificationStatus =
  | "unconfigured"
  | "needs-key"
  | "unverified"
  | "connected"
  | "failed";

export interface AiConnection {
  id: string;
  kind: "built-in" | "custom";
  providerId: AiProviderId;
  displayName: string;
  enabled: boolean;
  baseUrl: string;
  apiKeyRef: string | null;
  selectedModel: string;
  discoveredModels: string[];
  modelsFetchedAt: string | null;
  verificationStatus: AiVerificationStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiConnectionDraft {
  id: string;
  kind: "built-in" | "custom";
  providerId: AiProviderId;
  displayName: string;
  enabled: boolean;
  baseUrl: string;
  apiKeyRef: string | null;
  selectedModel: string;
  discoveredModels: string[];
  modelsFetchedAt: string | null;
}

export interface AiModelTarget {
  connectionId: string;
  model: string;
}

export interface AiFeatureRouting {
  chat: "inherit" | AiModelTarget;
  expression: "inherit" | AiModelTarget;
  script: "inherit" | AiModelTarget;
}

export interface AiGenerationPreferences {
  creativity: number;
  maxOutputTokens: number;
  streaming: boolean;
  timeoutMs: number;
  retryCount: number;
}

export interface AiSettings {
  schemaVersion: 1;
  connections: AiConnection[];
  globalDefault: AiModelTarget | null;
  featureRouting: AiFeatureRouting;
  generation: AiGenerationPreferences;
  saveConversationHistory: boolean;
  includeAeContext: boolean;
}

export interface AiProviderDefinition {
  id: BuiltInAiProviderId;
  displayName: string;
  defaultBaseUrl: string;
  supportsModelDiscovery: boolean;
}

