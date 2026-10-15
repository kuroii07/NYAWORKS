import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("keeps the withdrawn render probe inert even when the old path is run again", async () => {
  const script = await readFile("scripts/ae-tests/compare-camera-rig-render.jsx", "utf8");
  const alert = vi.fn();
  const accessHost = vi.fn(() => { throw new Error("withdrawn-probe-accessed-host"); });
  const sandbox = { alert };
  for (const name of ["app", "File", "Folder", "$", "CompItem", "system"]) {
    Object.defineProperty(sandbox, name, { get: accessHost });
  }
  runInNewContext(script, sandbox, { timeout: 1000 });
  expect(accessHost).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledOnce();
  expect(alert.mock.calls[0][0]).toContain("已停用");
});
