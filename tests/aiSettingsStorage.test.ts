import { describe, expect, it } from "vitest";
import {
  AI_SETTINGS_STORAGE_KEY,
  normalizeAiSettings,
  readStoredAiSettings,
  writeStoredAiSettings
} from "../src/aiSettings/aiSettingsStorage";
import { DEFAULT_AI_SETTINGS } from "../src/aiSettings/providerCatalog";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("AI settings storage", () => {
  it("creates all eight built-in providers without storing raw API keys", () => {
    const settings = readStoredAiSettings();

    expect(
      settings.connections.filter((item) => item.kind === "built-in")
    ).toHaveLength(8);
    expect(JSON.stringify(settings)).not.toContain('"apiKey":');
  });

  it("falls back to safe defaults when saved JSON is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(AI_SETTINGS_STORAGE_KEY, "{broken");

    expect(readStoredAiSettings(storage)).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("removes dangling routes and preserves valid manual models", () => {
    const normalized = normalizeAiSettings({
      schemaVersion: 1,
      connections: [
        {
          id: "custom:one",
          kind: "custom",
          providerId: "openai-compatible",
          displayName: " Studio Relay ",
          enabled: true,
          baseUrl: "https://example.com/v1/",
          apiKeyRef: "secret:one",
          selectedModel: "custom-model",
          discoveredModels: [],
          modelsFetchedAt: null,
          verificationStatus: "connected",
          lastTestedAt: null,
          createdAt: "2026-09-24T00:00:00.000Z",
          updatedAt: "2026-09-24T00:00:00.000Z"
        }
      ],
      globalDefault: { connectionId: "missing", model: "missing" },
      featureRouting: {
        chat: "inherit",
        expression: { connectionId: "missing", model: "missing" },
        script: { connectionId: "custom:one", model: "custom-model" }
      }
    });

    const custom = normalized.connections.find(
      (connection) => connection.id === "custom:one"
    );

    expect(custom?.displayName).toBe("Studio Relay");
    expect(custom?.baseUrl).toBe("https://example.com/v1");
    expect(normalized.globalDefault).toBeNull();
    expect(normalized.featureRouting.expression).toBe("inherit");
    expect(normalized.featureRouting.script).toEqual({
      connectionId: "custom:one",
      model: "custom-model"
    });
  });

  it("drops duplicate custom IDs and repairs invalid connection fields", () => {
    const normalized = normalizeAiSettings({
      connections: [
        {
          id: "custom:duplicate",
          kind: "custom",
          providerId: "openai-compatible",
          displayName: "First",
          enabled: true,
          baseUrl: "not-a-url",
          apiKeyRef: "secret:first",
          selectedModel: " first-model ",
          discoveredModels: [" first-model ", "", 42, "second-model"],
          verificationStatus: "connected"
        },
        {
          id: "custom:duplicate",
          kind: "custom",
          providerId: "openai-compatible",
          displayName: "Second",
          enabled: true,
          baseUrl: "https://second.example/v1",
          apiKeyRef: "secret:second",
          selectedModel: "second-model",
          discoveredModels: []
        }
      ]
    });

    const customConnections = normalized.connections.filter(
      (connection) => connection.kind === "custom"
    );

    expect(customConnections).toHaveLength(1);
    expect(customConnections[0].displayName).toBe("First");
    expect(customConnections[0].baseUrl).toBe("");
    expect(customConnections[0].selectedModel).toBe("first-model");
    expect(customConnections[0].discoveredModels).toEqual([
      "first-model",
      "second-model"
    ]);
    expect(customConnections[0].verificationStatus).toBe("needs-key");
  });

  it("round-trips non-secret settings without persisting raw key fields", () => {
    const storage = new MemoryStorage();
    const settings = normalizeAiSettings({
      ...DEFAULT_AI_SETTINGS,
      connections: DEFAULT_AI_SETTINGS.connections.map((connection, index) =>
        index === 0
          ? {
              ...connection,
              apiKeyRef: "secret:openai",
              selectedModel: "gpt-test",
              verificationStatus: "unverified"
            }
          : connection
      ),
      globalDefault: {
        connectionId: DEFAULT_AI_SETTINGS.connections[0].id,
        model: "gpt-test"
      },
      generation: {
        creativity: 65,
        maxOutputTokens: 4096,
        streaming: false,
        timeoutMs: 45000,
        retryCount: 2
      },
      saveConversationHistory: false,
      includeAeContext: true,
      apiKey: "must-not-persist"
    });

    writeStoredAiSettings(settings, storage);
    const raw = storage.getItem(AI_SETTINGS_STORAGE_KEY) ?? "";

    expect(raw).not.toContain("must-not-persist");
    expect(raw).not.toContain('"apiKey":');
    expect(readStoredAiSettings(storage)).toEqual(settings);
  });

  it("keeps a successful status in active state but requires the session key after reload", () => {
    const active = normalizeAiSettings({
      ...DEFAULT_AI_SETTINGS,
      connections: DEFAULT_AI_SETTINGS.connections.map((connection, index) =>
        index === 0
          ? {
              ...connection,
              apiKeyRef: "session:openai",
              selectedModel: "gpt-test",
              verificationStatus: "connected"
            }
          : connection
      )
    });
    const storage = new MemoryStorage();

    expect(active.connections[0].verificationStatus).toBe("connected");

    writeStoredAiSettings(active, storage);

    expect(readStoredAiSettings(storage).connections[0].verificationStatus).toBe(
      "needs-key"
    );
  });
});
