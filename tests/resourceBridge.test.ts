import { describe, expect, it } from "vitest";
import { createCepResourceBridge } from "../src/host/resourceBridge";
import { createDevelopmentResourceService } from "../src/resources/developmentResourceService";
import type { ResourceSource } from "../src/resources/types";

const customSource: ResourceSource = {
  id: "custom:tools",
  kind: "custom",
  resourceType: "script",
  name: "我的脚本",
  path: "C:/Tools/我的 脚本",
  enabled: true,
  hostVersion: null,
  status: "ready",
  lastScannedAt: null,
  lastError: null
};

describe("resource host bridge", () => {
  it("requests only the current AE default sources", async () => {
    const scripts: string[] = [];
    const bridge = createCepResourceBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(
            JSON.stringify({
              ok: true,
              version: "25.6.0",
              sources: [
                {
                  id: "ae-default:scripts",
                  kind: "ae-default",
                  resourceType: "script",
                  name: "AE Scripts",
                  path: "C:/Adobe/Support Files/Scripts",
                  enabled: true,
                  hostVersion: "25.6.0",
                  status: "ready",
                  lastScannedAt: null,
                  lastError: null
                }
              ]
            })
          );
        }
      }
    });

    await expect(bridge.readCurrentAeSources()).resolves.toMatchObject({
      status: "connected",
      hostVersion: "25.6.0"
    });
    expect(scripts).toEqual(["NYAWORKS.getCurrentResourceSources()"]);
  });

  it("returns a structured error when the CEP response is malformed or unavailable", async () => {
    await expect(createCepResourceBridge({}).readCurrentAeSources()).resolves.toEqual(
      {
        status: "unavailable",
        hostVersion: null,
        sources: [],
        isDevelopmentFixture: false
      }
    );

    const malformed = createCepResourceBridge({
      __adobe_cep__: { evalScript: (_script, callback) => callback("not-json") }
    });

    await expect(malformed.readCurrentAeSources()).resolves.toEqual({
      status: "error",
      hostVersion: null,
      sources: [],
      isDevelopmentFixture: false
    });
  });

  it("encodes a structured source payload before scanning", async () => {
    const scripts: string[] = [];
    const bridge = createCepResourceBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(
            JSON.stringify({
              sourceId: customSource.id,
              status: "ready",
              resources: [{ relativePath: "动画/Loop.jsx", modifiedAt: null }]
            })
          );
        }
      }
    });

    const result = await bridge.scanSource(customSource);
    const payload = scripts[0].match(/^NYAWORKS\.scanResourceSource\("(.+)"\)$/)?.[1];

    expect(JSON.parse(decodeURIComponent(payload ?? ""))).toEqual({
      id: customSource.id,
      kind: "custom",
      resourceType: "script",
      path: "C:/Tools/我的 脚本"
    });
    expect(result).toEqual({
      sourceId: customSource.id,
      status: "ready",
      resources: [{ relativePath: "动画/Loop.jsx", modifiedAt: null }]
    });
  });

  it("uses clearly marked fixture data without claiming a machine directory was read", async () => {
    const fixture = createDevelopmentResourceService();
    const sourceSnapshot = await fixture.readCurrentAeSources();
    const scanResult = await fixture.scanSource(sourceSnapshot.sources[0]);

    expect(sourceSnapshot).toMatchObject({
      status: "unavailable",
      isDevelopmentFixture: true
    });
    expect(sourceSnapshot.hostVersion).toBe("未连接 After Effects");
    expect(sourceSnapshot.sources[0].path).toContain("仅用于界面预览");
    expect(scanResult.status).toBe("ready");
    expect(scanResult.resources).toHaveLength(2);
  });
});
