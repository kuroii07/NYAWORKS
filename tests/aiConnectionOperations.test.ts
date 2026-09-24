import { describe, expect, it } from "vitest";
import {
  createCustomConnection,
  deleteConnection,
  duplicateConnectionWithoutSecret,
  renameConnection,
  setGlobalDefault,
  toggleConnection
} from "../src/aiSettings/connectionOperations";
import { DEFAULT_AI_SETTINGS } from "../src/aiSettings/providerCatalog";
import { normalizeAiSettings } from "../src/aiSettings/aiSettingsStorage";

function settingsWithCustomConnection() {
  return normalizeAiSettings({
    ...DEFAULT_AI_SETTINGS,
    connections: [
      ...DEFAULT_AI_SETTINGS.connections,
      {
        id: "custom:one",
        kind: "custom",
        providerId: "openai-compatible",
        displayName: "Studio Relay",
        enabled: true,
        baseUrl: "https://example.com/v1",
        apiKeyRef: "session:one",
        selectedModel: "model-one",
        discoveredModels: ["model-one"],
        modelsFetchedAt: "2026-09-24T00:00:00.000Z",
        verificationStatus: "connected",
        lastTestedAt: "2026-09-24T00:00:00.000Z",
        createdAt: "2026-09-24T00:00:00.000Z",
        updatedAt: "2026-09-24T00:00:00.000Z"
      }
    ],
    globalDefault: {
      connectionId: "custom:one",
      model: "model-one"
    },
    featureRouting: {
      chat: { connectionId: "custom:one", model: "model-one" },
      expression: { connectionId: "custom:one", model: "model-one" },
      script: "inherit"
    }
  });
}

describe("AI connection operations", () => {
  it("creates a uniquely named custom connection with the supplied ID", () => {
    const created = createCustomConnection(
      settingsWithCustomConnection(),
      {
        displayName: "Studio Relay",
        baseUrl: "https://second.example/v1",
        selectedModel: "model-two"
      },
      {
        id: "custom:two",
        now: "2026-09-24T01:00:00.000Z"
      }
    );
    const connection = created.connections.find(
      (item) => item.id === "custom:two"
    );

    expect(connection?.displayName).toBe("Studio Relay 2");
    expect(connection?.apiKeyRef).toBeNull();
  });

  it("duplicates configuration without copying the secret reference", () => {
    const duplicated = duplicateConnectionWithoutSecret(
      settingsWithCustomConnection(),
      "custom:one",
      {
        id: "custom:copy",
        now: "2026-09-24T02:00:00.000Z"
      }
    );
    const connection = duplicated.connections.find(
      (item) => item.id === "custom:copy"
    );

    expect(connection?.displayName).toBe("Studio Relay 副本");
    expect(connection?.baseUrl).toBe("https://example.com/v1");
    expect(connection?.selectedModel).toBe("model-one");
    expect(connection?.apiKeyRef).toBeNull();
    expect(connection?.verificationStatus).toBe("unconfigured");
  });

  it("repairs global and feature routes when a connection is deleted", () => {
    const deleted = deleteConnection(
      settingsWithCustomConnection(),
      "custom:one"
    );

    expect(deleted.globalDefault).toBeNull();
    expect(deleted.featureRouting.chat).toBe("inherit");
    expect(deleted.featureRouting.expression).toBe("inherit");
    expect(
      deleted.connections.some((item) => item.id === "custom:one")
    ).toBe(false);
  });

  it("repairs routes when a connection is disabled", () => {
    const disabled = toggleConnection(
      settingsWithCustomConnection(),
      "custom:one",
      false
    );

    expect(disabled.globalDefault).toBeNull();
    expect(disabled.featureRouting.chat).toBe("inherit");
    expect(disabled.featureRouting.expression).toBe("inherit");
  });

  it("does not rename or delete built-in connections", () => {
    const builtInId = DEFAULT_AI_SETTINGS.connections[0].id;
    const renamed = renameConnection(
      DEFAULT_AI_SETTINGS,
      builtInId,
      "Changed",
      "2026-09-24T03:00:00.000Z"
    );
    const deleted = deleteConnection(DEFAULT_AI_SETTINGS, builtInId);

    expect(renamed).toEqual(DEFAULT_AI_SETTINGS);
    expect(deleted).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("sets a saved enabled connection and model as the global default", () => {
    const updated = setGlobalDefault(
      settingsWithCustomConnection(),
      "custom:one",
      "model-one"
    );

    expect(updated.globalDefault).toEqual({
      connectionId: "custom:one",
      model: "model-one"
    });
  });
});
