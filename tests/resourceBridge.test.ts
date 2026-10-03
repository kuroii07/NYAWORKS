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

const indexedScript = {
  id: "custom:tools:animation/loop.jsx",
  sourceId: customSource.id,
  resourceType: "script" as const,
  name: "Loop",
  relativePath: "Animation/Loop.jsx",
  modifiedAt: null,
  favorite: false,
  lastUsedAt: null,
  preview: {
    coverUri: null,
    loopUri: null,
    cacheKey: null,
    status: "none" as const
  }
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

  it("opens the selected source folder through the AE host bridge", async () => {
    const scripts: string[] = [];
    const bridge = createCepResourceBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(JSON.stringify({ ok: true, path: customSource.path }));
        }
      }
    });

    await expect(bridge.openSourceDirectory(customSource)).resolves.toEqual({
      ok: true,
      path: customSource.path
    });
    const payload = scripts[0]?.match(/^NYAWORKS\.openResourceDirectory\("(.+)"\)$/)?.[1];
    expect(JSON.parse(decodeURIComponent(payload ?? ""))).toEqual({
      id: customSource.id,
      kind: "custom",
      resourceType: "script",
      path: customSource.path
    });
  });

  it("routes indexed resources to their matching AE host action", async () => {
    const scripts: string[] = [];
    const bridge = createCepResourceBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(JSON.stringify({ ok: true }));
        }
      }
    });
    const resource = indexedScript;

    await expect(bridge.useResource(customSource, resource)).resolves.toEqual({
      ok: true
    });
    await expect(
      bridge.useResource(
        { ...customSource, resourceType: "preset", path: "C:/Presets" },
        {
          ...resource,
          resourceType: "preset",
          relativePath: "Motion/Bounce.ffx"
        }
      )
    ).resolves.toEqual({ ok: true });
    await expect(
      bridge.useResource(
        { ...customSource, resourceType: "expression", path: "C:/Expressions" },
        {
          ...resource,
          resourceType: "expression",
          relativePath: "Loop.txt"
        }
      )
    ).resolves.toEqual({ ok: true });

    expect(scripts.map((script) => script.split("(")[0])).toEqual([
      "NYAWORKS.runSearchScript",
      "NYAWORKS.applySearchPreset",
      "NYAWORKS.applyResourceExpression"
    ]);
    expect(
      scripts.map((script) => {
        const payload = script.match(/\("(.+)"\)$/)?.[1] ?? "";
        return JSON.parse(decodeURIComponent(payload));
      })
    ).toEqual([
      { path: "C:/Tools/我的 脚本/Animation/Loop.jsx" },
      { path: "C:/Presets/Motion/Bounce.ffx" },
      { path: "C:/Expressions/Loop.txt" }
    ]);
  });

  it("marks ScriptUI panel resources so the host can use AE's native context", async () => {
    const scripts: string[] = [];
    const bridge = createCepResourceBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(JSON.stringify({ ok: true }));
        }
      }
    });

    await bridge.useResource(
      {
        ...customSource,
        id: "ae-default:scriptui-panels",
        kind: "ae-default",
        resourceType: "panel",
        path: "C:/Adobe/Scripts/ScriptUI Panels"
      },
      {
        id: "ae-default:scriptui-panels:keyfast.jsxbin",
        sourceId: "ae-default:scriptui-panels",
        resourceType: "panel",
        name: "KeyFast中文版",
        relativePath: "KeyFast%E4%B8%AD%E6%96%87%E7%89%88.jsxbin",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
      }
    );

    const payload = scripts[0].match(/\("(.+)"\)$/)?.[1] ?? "";
    expect(JSON.parse(decodeURIComponent(payload))).toEqual({
      path: "C:/Adobe/Scripts/ScriptUI Panels/KeyFast%E4%B8%AD%E6%96%87%E7%89%88.jsxbin",
      resourceType: "panel"
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

  it("encodes resource file actions and parses their results", async () => {
    const scripts: string[] = [];
    const bridge = createCepResourceBridge({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(JSON.stringify({
            ok: true,
            path: "C:/Tools/我的 脚本/Animation/Loop.jsx"
          }));
        }
      }
    });

    await expect(
      bridge.revealResourceFile(customSource, indexedScript)
    ).resolves.toEqual({
      ok: true,
      path: "C:/Tools/我的 脚本/Animation/Loop.jsx"
    });
    await expect(
      bridge.openResourceFile(customSource, indexedScript)
    ).resolves.toEqual({
      ok: true,
      path: "C:/Tools/我的 脚本/Animation/Loop.jsx"
    });

    expect(scripts.map((script) => script.split("(")[0])).toEqual([
      "NYAWORKS.revealResourceFile",
      "NYAWORKS.openResourceFile"
    ]);
    expect(scripts.map((script) => {
      const payload = script.match(/\("(.+)"\)$/)?.[1] ?? "";
      return JSON.parse(decodeURIComponent(payload));
    })).toEqual([
      {
        path: "C:/Tools/我的 脚本/Animation/Loop.jsx",
        resourceType: "script"
      },
      {
        path: "C:/Tools/我的 脚本/Animation/Loop.jsx",
        resourceType: "script"
      }
    ]);
  });

  it("normalizes typed host failures and affected item counts", async () => {
    const responses = [
      JSON.stringify({ ok: false, reason: "panel-not-registered" }),
      JSON.stringify({ ok: true, updatedItems: 2 }),
      JSON.stringify({ ok: false, reason: "system-open-failed" }),
      JSON.stringify({ ok: false, reason: "unsupported-file-type" })
    ];
    const bridge = createCepResourceBridge({
      __adobe_cep__: {
        evalScript: (_script, callback) => callback(responses.shift() ?? "")
      }
    });

    await expect(bridge.useResource(customSource, indexedScript)).resolves.toEqual({
      ok: false,
      reason: "panel-not-registered"
    });
    await expect(bridge.useResource(customSource, indexedScript)).resolves.toEqual({
      ok: true,
      affectedItems: 2
    });
    await expect(
      bridge.revealResourceFile(customSource, indexedScript)
    ).resolves.toEqual({ ok: false, reason: "system-open-failed" });
    await expect(
      bridge.openResourceFile(customSource, indexedScript)
    ).resolves.toEqual({ ok: false, reason: "unsupported-file-type" });
  });
});
