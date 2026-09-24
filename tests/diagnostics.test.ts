import { describe, expect, it } from "vitest";
import { createDiagnosticsReport } from "../src/about/diagnostics";

describe("about diagnostics", () => {
  it("exports useful environment data without secrets", () => {
    const report = createDiagnosticsReport({
      productVersion: "0.1.0-alpha.1",
      extensionId: "com.kuroii.nyaworks.panel",
      languageId: "zh-CN",
      themeId: "obsidian-cyan",
      densityId: "medium",
      hostInfo: {
        status: "connected",
        name: "Adobe After Effects",
        version: "25.6.0",
        projectName: "demo.aep"
      }
    });

    expect(report).toMatchObject({
      productVersion: "0.1.0-alpha.1",
      extensionId: "com.kuroii.nyaworks.panel",
      languageId: "zh-CN",
      themeId: "obsidian-cyan",
      densityId: "medium",
      host: {
        status: "connected",
        version: "25.6.0"
      }
    });
    expect(JSON.stringify(report).toLowerCase()).not.toContain("api_key");
    expect(JSON.stringify(report).toLowerCase()).not.toContain("license_key");
  });
});
