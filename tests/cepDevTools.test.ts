import { describe, expect, it, vi } from "vitest";
import {
  isCepDevBuild,
  reloadCepHostScript,
  reloadCepPanel
} from "../src/dev/cepDevTools";

describe("CEP development tools", () => {
  it("keeps the development-only controls disabled in the test build", () => {
    expect(isCepDevBuild).toBe(false);
  });

  it("reloads the active CEP panel through the current location", async () => {
    const reload = vi.fn();
    await reloadCepPanel({ reload });
    expect(reload).toHaveBeenCalledOnce();
  });

  it("loads the Host from the actual extension path before refreshing the panel", async () => {
    const reload = vi.fn();
    const evalScript = vi.fn((_script: string, callback: (result: string) => void) => {
      callback(JSON.stringify({ ok: true }));
    });

    await reloadCepPanel({ reload }, { __adobe_cep__: {
      evalScript, getSystemPath: () => "file:///C:/CEP/NYAWORKS"
    } });

    expect(evalScript.mock.calls[0][0]).toContain(encodeURIComponent("C:/CEP/NYAWORKS"));
    expect(evalScript.mock.calls[0][0]).toContain("/host/index.jsx");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("can refresh the host script without reloading the panel", async () => {
    const evalScript = vi.fn((_script: string, callback: (result: string) => void) => {
      callback(JSON.stringify({ ok: true }));
    });

    await expect(
      reloadCepHostScript({ __adobe_cep__: {
        evalScript, getSystemPath: () => "file:///C:/CEP/NYAWORKS"
      } })
    ).resolves.toBe(true);
    expect(evalScript.mock.calls[0][0]).toContain("getHostRevision");
  });

  it("does not pretend to refresh when the installed Host cannot be verified", async () => {
    const reload = vi.fn();
    const evalScript = vi.fn((_script: string, callback: (result: string) => void) => {
      callback(JSON.stringify({ ok: false }));
    });
    const result = await reloadCepPanel({ reload }, { __adobe_cep__: {
      evalScript, getSystemPath: () => "file:///C:/CEP/NYAWORKS"
    } });
    expect(result).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
