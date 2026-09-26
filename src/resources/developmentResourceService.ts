import type { ResourceHostBridge } from "../host/resourceBridge";
import type { ResourceSource } from "./types";

const FIXTURE_SOURCE: ResourceSource = {
  id: "ae-default:fixture-scripts",
  kind: "ae-default",
  resourceType: "script",
  name: "示例脚本",
  path: "仅用于界面预览，尚未连接 After Effects",
  enabled: true,
  hostVersion: "未连接 After Effects",
  status: "unavailable",
  lastScannedAt: null,
  lastError: "unavailable"
};

export function createDevelopmentResourceService(): ResourceHostBridge {
  return {
    async readCurrentAeSources() {
      return {
        status: "unavailable" as const,
        hostVersion: "未连接 After Effects",
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
