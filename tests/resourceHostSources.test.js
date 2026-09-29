import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadGetCurrentResourceSources() {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf(
    "  function createResourceSource(id, resourceType, name, relativePath) {"
  );
  const end = source.indexOf(
    "  function decodeResourcePayload(encodedPayload) {",
    start
  );

  if (start < 0 || end < 0) {
    throw new Error("Could not locate the resource source functions");
  }

  const Folder = function Folder(path) {
    this.fsName = String(path).replace(/\\/g, "/");
    this.exists = true;
  };
  Folder.startup = {
    fsName: "C:/Program Files/Adobe/Adobe After Effects 2025/Support Files"
  };

  return Function(
    "app",
    "Folder",
    "JSON",
    `${source.slice(start, end)}
return getCurrentResourceSources;`
  )(
    {
      version: "25.6.0",
      path: "C:/Program Files/Adobe/Adobe After Effects 2025/Support Files"
    },
    Folder,
    JSON
  );
}

describe("AE default resource source discovery", () => {
  it("resolves the installed AE resource folders from Folder.startup", async () => {
    const getCurrentResourceSources = await loadGetCurrentResourceSources();
    const result = JSON.parse(getCurrentResourceSources());

    expect(result.ok).toBe(true);
    expect(result.sources.map((source) => source.path)).toEqual([
      "C:/Program Files/Adobe/Adobe After Effects 2025/Support Files/Scripts",
      "C:/Program Files/Adobe/Adobe After Effects 2025/Support Files/Scripts/ScriptUI Panels",
      "C:/Program Files/Adobe/Adobe After Effects 2025/Support Files/Scripts/Startup"
    ]);
    expect(result.sources.some((source) => source.resourceType === "preset")).toBe(
      false
    );
  });
});
