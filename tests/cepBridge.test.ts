import { describe, expect, it } from "vitest";
import {
  openHostDataDirectory,
  readAfterEffectsHostInfo
} from "../src/host/cepBridge";

describe("CEP host bridge", () => {
  it("returns the active After Effects version from the host script", async () => {
    const scripts: string[] = [];
    const hostInfo = await readAfterEffectsHostInfo({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(
            JSON.stringify({
              name: "Adobe After Effects",
              version: "25.6.0",
              projectName: "demo.aep"
            })
          );
        }
      }
    });

    expect(scripts).toEqual(["NYAWORKS.getHostInfo()"]);
    expect(hostInfo).toEqual({
      status: "connected",
      name: "Adobe After Effects",
      version: "25.6.0",
      projectName: "demo.aep"
    });
  });

  it("reports an unavailable host in the browser preview", async () => {
    await expect(readAfterEffectsHostInfo({})).resolves.toEqual({
      status: "unavailable",
      name: null,
      version: null,
      projectName: null
    });
  });

  it("calls the host command used to open the managed data directory", async () => {
    const scripts: string[] = [];
    const result = await openHostDataDirectory({
      __adobe_cep__: {
        evalScript: (script, callback) => {
          scripts.push(script);
          callback(JSON.stringify({ ok: true, path: "C:/Users/Test/NYAWORKS" }));
        }
      }
    });

    expect(scripts).toEqual(["NYAWORKS.openDataDirectory()"]);
    expect(result).toEqual({
      ok: true,
      path: "C:/Users/Test/NYAWORKS"
    });
  });
});
