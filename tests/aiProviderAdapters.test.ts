import { describe, expect, it, vi } from "vitest";
import {
  listAiModels,
  testAiConnection
} from "../src/aiSettings/providerAdapters";
import type { AiConnectionDraft } from "../src/aiSettings/types";

function createDraft(
  patch: Partial<AiConnectionDraft> = {}
): AiConnectionDraft {
  return {
    id: "custom:test",
    kind: "custom",
    providerId: "openai-compatible",
    displayName: "Test",
    enabled: true,
    baseUrl: "https://api.example.com/v1",
    apiKeyRef: null,
    selectedModel: "manual-model",
    discoveredModels: [],
    modelsFetchedAt: null,
    ...patch
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = "OK"
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  } as Response;
}

describe("AI provider adapters", () => {
  it("normalizes OpenAI-compatible model responses without changing the draft", async () => {
    const draft = createDraft();
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
        data: [{ id: "model-b" }, { id: "model-a" }, { id: "model-a" }]
      })
    );

    const result = await listAiModels(
      draft,
      "sk-secret",
      fetcher as unknown as typeof fetch
    );

    expect(result).toEqual({
      ok: true,
      models: ["model-a", "model-b"]
    });
    expect(draft.selectedModel).toBe("manual-model");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-secret"
        })
      })
    );
    expect(String(fetcher.mock.calls[0][0])).not.toContain("sk-secret");
  });

  it("normalizes Gemini model names and sends the key in a header", async () => {
    const draft = createDraft({
      kind: "built-in",
      providerId: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta"
    });
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          models: [
            { name: "models/gemini-2.5-pro" },
            { name: "gemini-flash" }
          ]
        })
    );

    const result = await listAiModels(
      draft,
      "google-secret",
      fetcher as unknown as typeof fetch
    );
    const [url, init] = fetcher.mock.calls[0];

    expect(result).toEqual({
      ok: true,
      models: ["gemini-2.5-pro", "gemini-flash"]
    });
    expect(String(url)).not.toContain("google-secret");
    expect(init?.headers).toEqual(
      expect.objectContaining({ "x-goog-api-key": "google-secret" })
    );
  });

  it("returns unsupported when the provider has no reliable model endpoint", async () => {
    const result = await listAiModels(
      createDraft({
        kind: "built-in",
        providerId: "doubao",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3"
      }),
      "secret",
      vi.fn() as unknown as typeof fetch
    );

    expect(result).toEqual({ ok: false, error: "unsupported" });
  });

  it("maps unauthorized responses to invalid-key", async () => {
    const result = await listAiModels(
      createDraft(),
      "bad-secret",
      (async () => jsonResponse({}, 401, "Unauthorized")) as typeof fetch
    );

    expect(result).toEqual({ ok: false, error: "invalid-key" });
  });

  it("maps aborted requests to timeout", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";

    const result = await listAiModels(
      createDraft(),
      "secret",
      (async () => {
        throw abortError;
      }) as typeof fetch
    );

    expect(result).toEqual({ ok: false, error: "timeout" });
  });

  it("maps invalid payloads to invalid-response", async () => {
    const result = await listAiModels(
      createDraft(),
      "secret",
      (async () => jsonResponse({ data: [{ name: "missing-id" }] })) as typeof fetch
    );

    expect(result).toEqual({ ok: false, error: "invalid-response" });
  });

  it("tests a connection through the same safe request boundary", async () => {
    const result = await testAiConnection(
      createDraft(),
      "secret",
      (async () => jsonResponse({ data: [{ id: "model-one" }] })) as typeof fetch
    );

    expect(result).toEqual({ ok: true });
  });
});
