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

describe("AE resource execution paths", () => {
  it("indexes preset and expression files from custom directories", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function hasAllowedExtension(filename, resourceType) {");
    const end = source.indexOf("  function chooseResourceDirectory() {", start);
    if (start < 0 || end < 0) throw new Error("Could not locate resource scan functions");

    const tree = {
      "C:/Presets": [
        { name: "Bounce.ffx", modified: new Date("2026-01-01T00:00:00Z") },
        { name: "Ignore.jsx", modified: null },
        "StringPreset.ffx",
        { name: "Motion", getFiles() { return [{ name: "Scale.ffx", modified: null }]; } }
      ],
      "C:/Expressions": [
        { name: "Opacity.jsx", modified: null },
        { name: "Wiggle.json", modified: null },
        { name: "Loop.txt", modified: null },
        { name: "Ignore.ffx", modified: null }
      ]
    };
    const Folder = function Folder(path) {
      this.fsName = path;
      this.exists = Object.prototype.hasOwnProperty.call(tree, path);
      this.getFiles = () => tree[path] ?? [];
    };
    const File = function File() {};
    const scanResourceSource = Function(
      "Folder", "File", "JSON", "Date", "decodeURIComponent", "decodeResourcePayload",
      `${source.slice(start, end)}\nreturn scanResourceSource;`
    )(Folder, File, JSON, Date, decodeURIComponent, (payload) => JSON.parse(decodeURIComponent(payload)));
    const scan = (id, path, resourceType) => JSON.parse(scanResourceSource(encodeURIComponent(JSON.stringify({
      id, kind: "custom", resourceType, path
    }))));

    expect(scan("preset", "C:/Presets", "preset").resources.map((file) => file.relativePath))
      .toEqual(["Bounce.ffx", "StringPreset.ffx", "Motion/Scale.ffx"]);
    expect(scan("expression", "C:/Expressions", "expression").resources.map((file) => file.relativePath))
      .toEqual(["Opacity.jsx", "Wiggle.json", "Loop.txt"]);
  });

  it("opens a valid source directory through the host system shell", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    let openedPath = null;
    let executedCommand = null;
    const Folder = function Folder(path) {
      this.fsName = path;
      this.exists = true;
    };
    const openResourceDirectory = Function(
      "Folder", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn openResourceDirectory;`
    )(Folder, JSON, decodeURIComponent, {
      callSystem(command) { executedCommand = command; }
      }, { os: "Windows 11" });

    const payload = encodeURIComponent(JSON.stringify({ path: "C:/Assets/My Presets" }));
    expect(JSON.parse(openResourceDirectory(payload))).toEqual({ ok: true, path: "C:/Assets/My Presets" });
    expect(openedPath).toBeNull();
    expect(executedCommand).toBe('explorer.exe "C:/Assets/My Presets"');
  });

  it("decodes URI-encoded Unicode path segments before opening a resource", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    expect(source.match(/new File\(decodeResourceFilePath\(payload\.path\)\)/g)).toHaveLength(3);
    const start = source.indexOf("  function decodeSearchPayload(encodedPayload) {");
    const end = source.indexOf("  function selectedLayers() {", start);
    if (start < 0 || end < 0) {
      throw new Error("Could not locate the resource execution functions");
    }

    let openedPath = null;
    const File = function File(path) {
      this.path = String(path);
      this.exists = true;
    };
    const runSearchScript = Function(
      "JSON",
      "decodeURIComponent",
      "File",
      "$",
      `${source.slice(start, end)}\nreturn runSearchScript;`
    )(
      JSON,
      decodeURIComponent,
      File,
      { evalFile: (file) => { openedPath = file.path; } }
    );

    const payload = encodeURIComponent(JSON.stringify({
      path: "C:/Scripts/KeyFast%E4%B8%AD%E6%96%87%20Tool.jsx"
    }));
    expect(JSON.parse(runSearchScript(payload))).toEqual({ ok: true });
    expect(openedPath).toBe("C:/Scripts/KeyFast中文 Tool.jsx");
  });

  it("opens ScriptUI Panels through AE's native menu command context", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeSearchPayload(encodedPayload) {");
    const end = source.indexOf("  function selectedLayers() {", start);
    let executedCommand = null;
    let evaluatedFile = false;
    const File = function File(path) {
      this.path = String(path);
      this.name = this.path.split("/").pop();
      this.exists = true;
    };
    const runSearchScript = Function(
      "JSON",
      "decodeURIComponent",
      "File",
      "$",
      "app",
      `${source.slice(start, end)}\nreturn runSearchScript;`
    )(
      JSON,
      decodeURIComponent,
      File,
      { evalFile: () => { evaluatedFile = true; } },
      {
        findMenuCommandId: (name) => name === "KeyFast中文版" ? 4321 : 0,
        executeCommand: (id) => { executedCommand = id; }
      }
    );

    const payload = encodeURIComponent(JSON.stringify({
      path: "C:/Scripts/KeyFast%E4%B8%AD%E6%96%87%E7%89%88.jsxbin",
      resourceType: "panel"
    }));
    expect(JSON.parse(runSearchScript(payload))).toEqual({ ok: true });
    expect(executedCommand).toBe(4321);
    expect(evaluatedFile).toBe(false);
  });

  it("reveals a Unicode resource file with Explorer select", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    const commands = [];
    const Folder = function Folder() {};
    const File = function File(path) {
      this.fsName = String(path).replace(/\//g, "\\");
      this.exists = true;
    };
    const actions = Function(
      "Folder", "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile, openResourceFile };`
    )(
      Folder,
      File,
      JSON,
      decodeURIComponent,
      { callSystem: (command) => commands.push(command) },
      { os: "Windows 11" }
    );
    const payload = encodeURIComponent(JSON.stringify({
      path: "C:/资源/My Tool.jsx",
      resourceType: "script"
    }));

    expect(JSON.parse(actions.revealResourceFile(payload))).toEqual({
      ok: true,
      path: "C:\\资源\\My Tool.jsx"
    });
    expect(commands).toEqual([
      'explorer.exe /select,"C:\\资源\\My Tool.jsx"'
    ]);
  });

  it("decodes URL-encoded Unicode paths before revealing a resource file", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    const commands = [];
    const File = function File(path) {
      this.fsName = String(path).replace(/\//g, "\\");
      this.exists = true;
    };
    const actions = Function(
      "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile };`
    )(
      File,
      JSON,
      decodeURIComponent,
      { callSystem: (command) => commands.push(command) },
      { os: "Windows 11" }
    );

    expect(JSON.parse(actions.revealResourceFile(
      encodeURIComponent(JSON.stringify({
        path: "C:/资源/AutoSway%E4%B8%AD%E6%96%87.jsx",
        resourceType: "script"
      }))
    ))).toEqual({
      ok: true,
      path: "C:\\资源\\AutoSway中文.jsx"
    });
    expect(commands).toEqual([
      'explorer.exe /select,"C:\\资源\\AutoSway中文.jsx"'
    ]);
  });

  it("falls back when Explorer reports a failed command without throwing", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    let openedFolder = false;
    const File = function File(path) {
      this.fsName = String(path).replace(/\//g, "\\");
      this.exists = true;
      this.parent = {
        execute() {
          openedFolder = true;
          return true;
        }
      };
    };
    const actions = Function(
      "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile };`
    )(
      File,
      JSON,
      decodeURIComponent,
      { callSystem: () => "The system cannot find the path specified." },
      { os: "Windows 11" }
    );

    expect(JSON.parse(actions.revealResourceFile(
      encodeURIComponent(JSON.stringify({
        path: "C:/资源/Missing Selection.jsx",
        resourceType: "script"
      }))
    ))).toMatchObject({
      ok: true,
      fallback: "folder"
    });
    expect(openedFolder).toBe(true);
  });

  it("accepts a successful Folder.execute call when AE returns no boolean", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    let openedFolder = false;
    const File = function File(path) {
      this.fsName = String(path).replace(/\//g, "\\");
      this.exists = true;
      this.parent = {
        execute() {
          openedFolder = true;
          return undefined;
        }
      };
    };
    const actions = Function(
      "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile };`
    )(
      File,
      JSON,
      decodeURIComponent,
      { callSystem: () => "Explorer failed" },
      { os: "Windows 11" }
    );

    expect(JSON.parse(actions.revealResourceFile(
      encodeURIComponent(JSON.stringify({
        path: "C:/资源/AutoSway.jsxbin",
        resourceType: "script"
      }))
    ))).toMatchObject({
      ok: true,
      fallback: "folder"
    });
    expect(openedFolder).toBe(true);
  });

  it("falls back to opening the containing folder when Explorer select is unavailable", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    let openedFolder = null;
    const Folder = function Folder() {};
    const File = function File(path) {
      this.fsName = String(path).replace(/\//g, "\\");
      this.exists = true;
      this.parent = {
        execute() {
          openedFolder = true;
          return true;
        }
      };
    };
    const actions = Function(
      "Folder", "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile };`
    )(
      Folder,
      File,
      JSON,
      decodeURIComponent,
      { callSystem() { throw new Error("Explorer unavailable"); } },
      { os: "Windows 11" }
    );

    const result = JSON.parse(actions.revealResourceFile(
      encodeURIComponent(JSON.stringify({
        path: "C:/资源/My Tool.jsx",
        resourceType: "script"
      }))
    ));
    expect(result).toEqual({
      ok: true,
      path: "C:\\资源\\My Tool.jsx",
      fallback: "folder"
    });
    expect(openedFolder).toBe(true);
  });

  it.each([
    'C:/Tools/Bad"Name.jsx',
    "C:/Tools/Bad\rName.jsx",
    "C:/Tools/Bad\nName.jsx"
  ])("rejects an unsafe reveal path before calling the system: %s", async (path) => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    const commands = [];
    const actions = Function(
      "Folder", "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile, openResourceFile };`
    )(
      function Folder() {},
      function File(filePath) { this.fsName = filePath; this.exists = true; },
      JSON,
      decodeURIComponent,
      { callSystem: (command) => commands.push(command) },
      { os: "Windows 11" }
    );

    expect(JSON.parse(actions.revealResourceFile(
      encodeURIComponent(JSON.stringify({ path, resourceType: "script" }))
    ))).toEqual({ ok: false, reason: "invalid-resource" });
    expect(commands).toEqual([]);
  });

  it("returns invalid-resource when the file no longer exists", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    const actions = Function(
      "Folder", "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile, openResourceFile };`
    )(
      function Folder() {},
      function File(path) { this.fsName = path; this.exists = false; },
      JSON,
      decodeURIComponent,
      { callSystem() { throw new Error("must not run"); } },
      { os: "Windows 11" }
    );

    expect(JSON.parse(actions.revealResourceFile(
      encodeURIComponent(JSON.stringify({ path: "C:/Tools/Missing.jsx", resourceType: "script" }))
    ))).toEqual({ ok: false, reason: "invalid-resource" });
  });

  it("opens editable resources with the system default application", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    const executed = [];
    const actions = Function(
      "Folder", "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile, openResourceFile };`
    )(
      function Folder() {},
      function File(path) {
        this.fsName = String(path);
        this.name = String(path).split("/").pop();
        this.exists = true;
        this.execute = () => { executed.push(this.fsName); return true; };
      },
      JSON,
      decodeURIComponent,
      { callSystem() { throw new Error("default open must not use the shell"); } },
      { os: "Windows 11" }
    );
    const payload = encodeURIComponent(JSON.stringify({
      path: "C:/Tools/Edit Me.jsx",
      resourceType: "script"
    }));

    expect(JSON.parse(actions.openResourceFile(payload))).toEqual({
      ok: true,
      path: "C:/Tools/Edit Me.jsx"
    });
    expect(executed).toEqual(["C:/Tools/Edit Me.jsx"]);
  });

  it.each([
    ["C:/Tools/Binary.jsxbin", "script"],
    ["C:/Presets/Bounce.ffx", "preset"],
    ["C:/Tools/Unknown.bin", "script"]
  ])("rejects unsupported default-open file %s", async (path, resourceType) => {
    const source = await readFile("public/host/index.jsx", "utf8");
    const start = source.indexOf("  function decodeResourcePayload(encodedPayload) {");
    const end = source.indexOf("  function getCurrentEffects() {", start);
    const actions = Function(
      "Folder", "File", "JSON", "decodeURIComponent", "system", "$",
      `${source.slice(start, end)}\nreturn { revealResourceFile, openResourceFile };`
    )(
      function Folder() {},
      function File(filePath) {
        this.fsName = filePath;
        this.name = String(filePath).split("/").pop();
        this.exists = true;
        this.execute = () => true;
      },
      JSON,
      decodeURIComponent,
      {},
      { os: "Windows 11" }
    );

    expect(JSON.parse(actions.openResourceFile(
      encodeURIComponent(JSON.stringify({ path, resourceType }))
    ))).toEqual({ ok: false, reason: "unsupported-file-type" });
  });
});
