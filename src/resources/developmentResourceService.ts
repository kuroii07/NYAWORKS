import type { ResourceHostBridge } from "../host/resourceBridge";
import type { ResourceSource } from "./types";

const FIXTURE_SOURCE: ResourceSource = {
  id: "ae-default:fixture-scripts",
  kind: "ae-default",
  resourceType: "script",
  name: "Development fixture · Scripts",
  path: "development fixture · no machine directory",
  enabled: true,
  hostVersion: "Development fixture",
  status: "unavailable",
  lastScannedAt: null,
  lastError: "unavailable"
};

export function createDevelopmentResourceService(): ResourceHostBridge {
  return {
    async readCurrentAeSources() {
      return {
        status: "unavailable" as const,
        hostVersion: "Development fixture",
        sources: [FIXTURE_SOURCE],
        isDevelopmentFixture: true
      };
    },
    async scanSource(source) {
      return {
        sourceId: source.id,
        status: "ready" as const,
        resources: [
          { relativePath: "Compositions/QuickComp.jsx", modifiedAt: null },
          { relativePath: "Layers/SelectText.jsx", modifiedAt: null }
        ]
      };
    },
    async chooseDirectory() {
      return { status: "unavailable" as const, path: null };
    }
  };
}
