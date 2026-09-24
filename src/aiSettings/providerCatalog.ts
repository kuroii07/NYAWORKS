import type {
  AiConnection,
  AiProviderDefinition,
  AiSettings
} from "./types";

const INITIAL_TIMESTAMP = "2026-09-24T00:00:00.000Z";

export const AI_PROVIDER_CATALOG: readonly AiProviderDefinition[] = [
  {
    id: "openai",
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportsModelDiscovery: true
  },
  {
    id: "claude",
    displayName: "Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    supportsModelDiscovery: true
  },
  {
    id: "gemini",
    displayName: "Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    supportsModelDiscovery: true
  },
  {
    id: "deepseek",
    displayName: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    supportsModelDiscovery: true
  },
  {
    id: "qwen",
    displayName: "通义千问",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    supportsModelDiscovery: true
  },
  {
    id: "doubao",
    displayName: "豆包",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    supportsModelDiscovery: true
  },
  {
    id: "kimi",
    displayName: "Kimi",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    supportsModelDiscovery: true
  },
  {
    id: "zhipu",
    displayName: "智谱 GLM",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    supportsModelDiscovery: true
  }
] as const;

export const BUILT_IN_AI_CONNECTIONS: readonly AiConnection[] =
  AI_PROVIDER_CATALOG.map((provider) => ({
    id: `built-in:${provider.id}`,
    kind: "built-in",
    providerId: provider.id,
    displayName: provider.displayName,
    enabled: true,
    baseUrl: provider.defaultBaseUrl,
    apiKeyRef: null,
    selectedModel: "",
    discoveredModels: [],
    modelsFetchedAt: null,
    verificationStatus: "unconfigured",
    lastTestedAt: null,
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP
  }));

export const DEFAULT_AI_SETTINGS: AiSettings = {
  schemaVersion: 1,
  connections: BUILT_IN_AI_CONNECTIONS.map((connection) => ({
    ...connection,
    discoveredModels: []
  })),
  globalDefault: null,
  featureRouting: {
    chat: "inherit",
    expression: "inherit",
    script: "inherit"
  },
  generation: {
    creativity: 70,
    maxOutputTokens: 4096,
    streaming: true,
    timeoutMs: 60000,
    retryCount: 1
  },
  saveConversationHistory: true,
  includeAeContext: false
};

export function getAiProviderDefinition(
  providerId: AiConnection["providerId"]
): AiProviderDefinition | null {
  return (
    AI_PROVIDER_CATALOG.find((provider) => provider.id === providerId) ?? null
  );
}

