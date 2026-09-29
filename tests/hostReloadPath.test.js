import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadReloadHostScript(dollar) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const declarationStart = source.indexOf("  var hostScriptFile =");
  const declarationEnd = declarationStart < 0
    ? -1
    : source.indexOf("\n", declarationStart);
  const functionStart = source.indexOf("  function reloadHostScript() {");
  const functionEnd = source.indexOf(
    "  function decodeSearchPayload(encodedPayload) {",
    functionStart
  );
  if (functionStart < 0 || functionEnd < 0) {
    throw new Error("Could not locate reloadHostScript");
  }
  const declaration = declarationStart < 0 || declarationEnd < 0
    ? ""
    : source.slice(declarationStart, declarationEnd);

  return Function(
    "$",
    "File",
    `${declaration}
${source.slice(functionStart, functionEnd)}
return reloadHostScript;`
  )(
    dollar,
    function File(path) {
      this.path = path;
    }
  );
}

describe("CEP host reload path", () => {
  it("reloads the original NYAWORKS host file even when the caller changes", async () => {
    const evaluated = [];
    const dollar = {
      fileName: "C:/NYAWORKS/host/index.jsx",
      evalFile(file) {
        evaluated.push(file.path);
      }
    };
    const reloadHostScript = await loadReloadHostScript(dollar);

    dollar.fileName = "C:/Temp/caller.jsx";
    expect(JSON.parse(reloadHostScript())).toEqual({ ok: true });
    expect(evaluated).toEqual(["C:/NYAWORKS/host/index.jsx"]);
  });
});
