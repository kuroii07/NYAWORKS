import { getAiProviderDefinition } from "./providerCatalog";
import { createDevelopmentAiFetcher } from "./developmentFixtures";
import type { AiConnectionDraft, AiProviderId } from "./types";

export type AiRequestErrorCode =
  | "missing-configuration"
  | "invalid-key"
  | "unsupported"
  | "timeout"
  | "unreachable"
  | "server-error"
  | "invalid-response";

export type AiModelListResult =
  | { ok: true; models: string[] }
  | { ok: false; error: AiRequestErrorCode };

export type AiConnectionTestResult =
  | { ok: true }
  | { ok: false; error: AiRequestErrorCode };

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  parseModels: (payload: unknown) => string[] | null;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeModelIds(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.replace(/^models\//, "").trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function parseOpenAiModels(payload: unknown): string[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = (payload as { data?: unknown }).data;

  if (!Array.isArray(data)) {
    return null;
  }

  const models = normalizeModelIds(
    data.map((item) =>
      item && typeof item === "object"
        ? (item as { id?: unknown }).id
        : undefined
    )
  );

  return models.length > 0 ? models : null;
}

function parseGeminiModels(payload: unknown): string[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const modelsValue = (payload as { models?: unknown }).models;

  if (!Array.isArray(modelsValue)) {
    return null;
  }

  const models = normalizeModelIds(
    modelsValue.map((item) =>
      item && typeof item === "object"
        ? (item as { name?: unknown }).name
        : undefined
    )
  );

  return models.length > 0 ? models : null;
}

function createRequest(
  draft: AiConnectionDraft,
  secret: string
): ProviderRequest | null {
  const baseUrl = trimTrailingSlash(draft.baseUrl);

  if (!baseUrl || !secret.trim()) {
    return null;
  }

  if (draft.providerId === "doubao") {
    return null;
  }

  if (draft.providerId === "gemini") {
    return {
      url: `${baseUrl}/models`,
      headers: {
        Accept: "application/json",
        "x-goog-api-key": secret
      },
      parseModels: parseGeminiModels
    };
  }

  if (draft.providerId === "claude") {
    return {
      url: `${baseUrl}/models`,
      headers: {
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": secret
      },
      parseModels: parseOpenAiModels
    };
  }

  return {
    url: `${baseUrl}/models`,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secret}`
    },
    parseModels: parseOpenAiModels
  };
}

function supportsModelDiscovery(providerId: AiProviderId): boolean {
  if (providerId === "openai-compatible") {
    return true;
  }

  return getAiProviderDefinition(providerId)?.supportsModelDiscovery ?? false;
}

function normalizeResponseError(status: number): AiRequestErrorCode {
  if (status === 401 || status === 403) {
    return "invalid-key";
  }

  if (status >= 500) {
    return "server-error";
  }

  return "unreachable";
}

function normalizeThrownError(error: unknown): AiRequestErrorCode {
  return error instanceof Error && error.name === "AbortError"
    ? "timeout"
    : "unreachable";
}

function resolveFetcher(fetcher?: typeof fetch): typeof fetch {
  if (fetcher) {
    return fetcher;
  }

  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    typeof window.location?.search === "string"
  ) {
    const fixtureFetcher = createDevelopmentAiFetcher(window.location.search);

    if (fixtureFetcher) {
      return fixtureFetcher;
    }
  }

  return fetch;
}

export async function listAiModels(
  draft: AiConnectionDraft,
  secret: string,
  fetcher?: typeof fetch,
  signal?: AbortSignal
): Promise<AiModelListResult> {
  if (!supportsModelDiscovery(draft.providerId)) {
    return { ok: false, error: "unsupported" };
  }

  const request = createRequest(draft, secret);

  if (!request) {
    return {
      ok: false,
      error:
        draft.providerId === "doubao"
          ? "unsupported"
          : "missing-configuration"
    };
  }

  try {
    const response = await resolveFetcher(fetcher)(request.url, {
      method: "GET",
      headers: request.headers,
      signal
    });

    if (!response.ok) {
      return { ok: false, error: normalizeResponseError(response.status) };
    }

    const payload: unknown = await response.json();
    const models = request.parseModels(payload);

    return models
      ? { ok: true, models }
      : { ok: false, error: "invalid-response" };
  } catch (error) {
    return { ok: false, error: normalizeThrownError(error) };
  }
}

export async function testAiConnection(
  draft: AiConnectionDraft,
  secret: string,
  fetcher?: typeof fetch,
  signal?: AbortSignal
): Promise<AiConnectionTestResult> {
  const result = await listAiModels(draft, secret, fetcher, signal);

  return result.ok ? { ok: true } : result;
}
