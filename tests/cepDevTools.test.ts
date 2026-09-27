import { describe, expect, it, vi } from "vitest";
import { isCepDevBuild, reloadCepPanel } from "../src/dev/cepDevTools";

describe("CEP development tools", () => {
  it("keeps the development-only controls disabled in the test build", () => {
    expect(isCepDevBuild).toBe(false);
  });

  it("reloads the active CEP panel through the current location", () => {
    const reload = vi.fn();
    reloadCepPanel({ reload });
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads the host script before refreshing a CEP panel", () => {
    const reload = vi.fn();
    const evalScript = vi.fn((_script: string, callback: (result: string) => void) => {
      callback(JSON.stringify({ ok: true }));
    });

    reloadCepPanel({ reload }, { __adobe_cep__: { evalScript } });

    expect(evalScript).toHaveBeenCalledWith(
      "NYAWORKS.reloadHostScript()",
      expect.any(Function)
    );
    expect(reload).toHaveBeenCalledOnce();
  });
});
