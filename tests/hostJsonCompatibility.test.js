import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadHostWithoutNativeJson() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const dollar = {
    fileName: "C:/NYAWORKS/host/index.jsx",
    global: {}
  };
  const app = {
    name: "Adobe After Effects",
    version: "25.6",
    project: null
  };

  return Function(
    "$",
    "app",
    "File",
    "Folder",
    "JSON",
    `${source}\nreturn { info: $.global.NYAWORKS.getHostInfo(), parsed: $.global.JSON.parse('{"ok":true,"count":2}') };`
  )(
    dollar,
    app,
    function File() {},
    function Folder() {},
    undefined
  );
}

describe("CEP host JSON compatibility", () => {
  it("returns host info when ExtendScript starts without a native JSON object", async () => {
    const result = await loadHostWithoutNativeJson();

    expect(JSON.parse(result.info)).toMatchObject({
      name: "Adobe After Effects",
      version: "25.6",
      projectName: null
    });
    expect(result.parsed).toEqual({ ok: true, count: 2 });
  });
});
