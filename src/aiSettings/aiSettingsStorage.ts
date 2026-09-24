import {
  AI_PROVIDER_CATALOG,
  BUILT_IN_AI_CONNECTIONS,
  DEFAULT_AI_SETTINGS
} from "./providerCatalog";
import {
  BUILT_IN_AI_PROVIDER_IDS,
  type AiConnection,
  type AiFeatureRouting,
  type AiGenerationPreferences,
  type AiModelTarget,
  type AiProviderId,
  type AiSettings,
  type AiVerificationStatus
} from "./types";

export const AI_SETTINGS_STORAGE_KEY = "nyaworks.settings.ai.v1";

interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isProviderId(value: unknown): value is AiProviderId {
  return (
    value === "openai-compatible" ||
    (typeof value === "string" &&
      BUILT_IN_AI_PROVIDER_IDS.includes(
        value as (typeof BUILT_IN_AI_PROVIDER_IDS)[number]
      ))
  );
}

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeNullableDate(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return new Date(value).toISOString();
}

function normalizeDate(value: unknown, fallback: string): string {
  return normalizeNullableDate(value) ?? fallback;
}

function normalizeUrl(value: unknown): string {
  const candidate = normalizeString(value, 2048).replace(/\/+$/, "");

  if (!candidate) {
    return "";
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString().replace(/\/+$/, "")
      : "";
  } catch {
    return "";
  }
}

function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 200)
    )
  );
}

function normalizeVerificationStatus(
  value: unknown,
  apiKeyRef: string | null,
  baseUrl: string,
  model: string
): AiVerificationStatus {
  if (!apiKeyRef) {
    return "unconfigured";
  }

  if (!baseUrl || !model || value === "connected") {
    return "needs-key";
  }

  return value === "failed" || value === "unverified" || value === "needs-key"
    ? value
    : "unverified";
}

function normalizeConnection(
  value: unknown,
  fallback?: AiConnection
): AiConnection | null {
  if (!isRecord(value)) {
    return fallback ? { ...fallback, discoveredModels: [] } : null;
  }

  const kind =
    value.kind === "built-in" || value.kind === "custom"
      ? value.kind
      : fallback?.kind;
  const providerId = isProviderId(value.providerId)
    ? value.providerId
    : fallback?.providerId;
  const id = normalizeString(value.id, 96) || fallback?.id || "";

  if (!kind || !providerId || !id) {
    return null;
  }

  if (
    kind === "built-in" &&
    (!id.startsWith("built-in:") ||
      providerId === "openai-compatible" ||
      id !== `built-in:${providerId}`)
  ) {
    return fallback ? { ...fallback, discoveredModels: [] } : null;
  }

  if (kind === "custom" && providerId !== "openai-compatible") {
    return null;
  }

  const now = new Date().toISOString();
  const apiKeyRef = normalizeString(value.apiKeyRef, 160) || null;
  const baseUrl = normalizeUrl(value.baseUrl ?? fallback?.baseUrl);
  const selectedModel = normalizeString(value.selectedModel, 180);
  const displayName =
    normalizeString(value.displayName, 32) ||
    fallback?.displayName ||
    (kind === "custom" ? "Custom AI" : id);

  return {
    id,
    kind,
    providerId,
    displayName,
    enabled: isBoolean(value.enabled) ? value.enabled : fallback?.enabled ?? true,
    baseUrl,
    apiKeyRef,
    selectedModel,
    discoveredModels: normalizeModels(value.discoveredModels),
    modelsFetchedAt: normalizeNullableDate(value.modelsFetchedAt),
    verificationStatus: normalizeVerificationStatus(
      value.verificationStatus,
      apiKeyRef,
      baseUrl,
      selectedModel
    ),
    lastTestedAt: normalizeNullableDate(value.lastTestedAt),
    createdAt: normalizeDate(value.createdAt, fallback?.createdAt ?? now),
    updatedAt: normalizeDate(value.updatedAt, fallback?.updatedAt ?? now)
  };
}

function normalizeTarget(
  value: unknown,
  validConnections: readonly AiConnection[]
): AiModelTarget | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId = normalizeString(value.connectionId, 96);
  const model = normalizeString(value.model, 180);
  const connection = validConnections.find(
    (candidate) => candidate.id === connectionId && candidate.enabled
  );

  return connection && model ? { connectionId, model } : null;
}

function normalizeRouting(
  value: unknown,
  connections: readonly AiConnection[]
): AiFeatureRouting {
  const candidate = isRecord(value) ? value : {};

  function normalizeRoute(route: unknown): "inherit" | AiModelTarget {
    if (route === "inherit") {
      return "inherit";
    }

    return normalizeTarget(route, connections) ?? "inherit";
  }

  return {
    chat: normalizeRoute(candidate.chat),
    expression: normalizeRoute(candidate.expression),
    script: normalizeRoute(candidate.script)
  };
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

function normalizeGeneration(value: unknown): AiGenerationPreferences {
  const candidate = isRecord(value) ? value : {};

  return {
    creativity: clampInteger(
      candidate.creativity,
      0,
      100,
      DEFAULT_AI_SETTINGS.generation.creativity
    ),
    maxOutputTokens: clampInteger(
      candidate.maxOutputTokens,
      256,
      32768,
      DEFAULT_AI_SETTINGS.generation.maxOutputTokens
    ),
    streaming: isBoolean(candidate.streaming)
      ? candidate.streaming
      : DEFAULT_AI_SETTINGS.generation.streaming,
    timeoutMs: clampInteger(
      candidate.timeoutMs,
      5000,
      180000,
      DEFAULT_AI_SETTINGS.generation.timeoutMs
    ),
    retryCount: clampInteger(
      candidate.retryCount,
      0,
      3,
      DEFAULT_AI_SETTINGS.generation.retryCount
    )
  };
}

export function normalizeAiSettings(value: unknown): AiSettings {
  const candidate = isRecord(value) ? value : {};
  const rawConnections = Array.isArray(candidate.connections)
    ? candidate.connections
    : [];
  const seenIds = new Set<string>();

  const builtInConnections = BUILT_IN_AI_CONNECTIONS.map((fallback) => {
    const saved = rawConnections.find(
      (connection) =>
        isRecord(connection) &&
        connection.id === fallback.id &&
        connection.kind === "built-in"
    );
    const normalized = normalizeConnection(saved, fallback) ?? fallback;
    seenIds.add(normalized.id);
    return normalized;
  });

  const customConnections: AiConnection[] = [];

  for (const rawConnection of rawConnections) {
    const normalized = normalizeConnection(rawConnection);

    if (
      !normalized ||
      normalized.kind !== "custom" ||
      seenIds.has(normalized.id)
    ) {
      continue;
    }

    seenIds.add(normalized.id);
    customConnections.push(normalized);
  }

  const connections = [...builtInConnections, ...customConnections];
  const globalDefault = normalizeTarget(candidate.globalDefault, connections);

  return {
    schemaVersion: 1,
    connections,
    globalDefault,
    featureRouting: normalizeRouting(candidate.featureRouting, connections),
    generation: normalizeGeneration(candidate.generation),
    saveConversationHistory: isBoolean(candidate.saveConversationHistory)
      ? candidate.saveConversationHistory
      : DEFAULT_AI_SETTINGS.saveConversationHistory,
    includeAeContext: isBoolean(candidate.includeAeContext)
      ? candidate.includeAeContext
      : DEFAULT_AI_SETTINGS.includeAeContext
  };
}

export function readStoredAiSettings(storage?: SettingsStorage): AiSettings {
  if (!storage) {
    return normalizeAiSettings(DEFAULT_AI_SETTINGS);
  }

  try {
    const stored = storage.getItem(AI_SETTINGS_STORAGE_KEY);
    return stored
      ? normalizeAiSettings(JSON.parse(stored))
      : normalizeAiSettings(DEFAULT_AI_SETTINGS);
  } catch {
    return normalizeAiSettings(DEFAULT_AI_SETTINGS);
  }
}

export function writeStoredAiSettings(
  settings: AiSettings,
  storage?: SettingsStorage
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeAiSettings(settings))
    );
  } catch {
    // CEP can run with storage unavailable. Keep the current session usable.
  }
}

export function getDefaultBaseUrl(providerId: AiProviderId): string {
  return (
    AI_PROVIDER_CATALOG.find((provider) => provider.id === providerId)
      ?.defaultBaseUrl ?? ""
  );
}

