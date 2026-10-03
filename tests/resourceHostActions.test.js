import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadResourceAction(name, { app, File }) {
  const source = await readFile("public/host/index.jsx", "utf8");
  const start = source.indexOf(
    "  function decodeSearchPayload(encodedPayload) {"
  );
  const end = source.indexOf(
    "  function anchorPositionFraction(position) {",
    start
  );

  if (start < 0 || end < 0) {
    throw new Error("Could not locate the resource action functions");
  }

  return Function(
    "app",
    "File",
    "JSON",
    "decodeURIComponent",
    `${source.slice(start, end)}
return ${name};`
  )(app, File, JSON, decodeURIComponent);
}

describe("resource host actions", () => {
  it("writes a text expression to every selected expression-capable property", async () => {
    const firstProperty = { canSetExpression: true, expression: "" };
    const ignoredProperty = { canSetExpression: false, expression: "" };
    const secondProperty = { canSetExpression: true, expression: "" };
    const undoGroups = [];
    const app = {
      project: {
        activeItem: {
          selectedProperties: [firstProperty, ignoredProperty, secondProperty]
        }
      },
      beginUndoGroup(name) {
        undoGroups.push(`begin:${name}`);
      },
      endUndoGroup() {
        undoGroups.push("end");
      }
    };
    const File = function File(path) {
      this.path = path;
      this.exists = true;
      this.encoding = "";
      this.open = () => true;
      this.read = () => "value * 2";
      this.close = () => true;
    };
    const applyResourceExpression = await loadResourceAction("applyResourceExpression", {
      app,
      File
    });
    const payload = encodeURIComponent(
      JSON.stringify({ path: "C:/Expressions/Scale.txt" })
    );

    expect(JSON.parse(applyResourceExpression(payload))).toEqual({
      ok: true,
      updatedItems: 2
    });
    expect(firstProperty.expression).toBe("value * 2");
    expect(ignoredProperty.expression).toBe("");
    expect(secondProperty.expression).toBe("value * 2");
    expect(undoGroups).toEqual([
      "begin:NYAWORKS Apply Expression",
      "end"
    ]);
  });

  it("loads expression JSON files using either supported field", async () => {
    const property = { canSetExpression: true, expression: "" };
    const app = {
      project: { activeItem: { selectedProperties: [property] } },
      beginUndoGroup() {},
      endUndoGroup() {}
    };
    const contents = {
      "C:/Expressions/Opacity.json": JSON.stringify({ expression: "value / 100" }),
      "C:/Expressions/Scale.json": JSON.stringify({ code: "value * 2" })
    };
    const File = function File(path) {
      this.path = path;
      this.name = path.split("/").pop();
      this.exists = true;
      this.opened = false;
      this.open = () => { this.opened = true; return true; };
      this.read = () => contents[path];
      this.close = () => { this.opened = false; };
    };
    const applyResourceExpression = await loadResourceAction("applyResourceExpression", { app, File });

    for (const [path, expected] of Object.entries({
      "C:/Expressions/Opacity.json": "value / 100",
      "C:/Expressions/Scale.json": "value * 2"
    })) {
      const payload = encodeURIComponent(JSON.stringify({ path }));
      expect(JSON.parse(applyResourceExpression(payload)).ok).toBe(true);
      expect(property.expression).toBe(expected);
    }
  });

  it("opens a registered panel without evaluating its file", async () => {
    const calls = [];
    const app = {
      findMenuCommandId: (name) => name === "Motion Panel" ? 4321 : 0,
      executeCommand: (id) => calls.push(`command:${id}`)
    };
    const File = function File(path) {
      this.name = String(path).split("/").pop();
      this.exists = true;
    };
    const dollar = { evalFile: () => calls.push("eval") };
    const runSearchScript = await loadResourceAction("runSearchScript", {
      app,
      File
    });
    const originalDollar = globalThis.$;
    globalThis.$ = dollar;
    try {
      const payload = encodeURIComponent(JSON.stringify({
        path: "C:/Panels/Motion Panel.jsx",
        resourceType: "panel"
      }));
      expect(JSON.parse(runSearchScript(payload))).toEqual({ ok: true });
      expect(calls).toEqual(["command:4321"]);
    } finally {
      globalThis.$ = originalDollar;
    }
  });

  it("refuses an unregistered panel instead of evaluating it as a script", async () => {
    const calls = [];
    const app = {
      findMenuCommandId: () => 0,
      executeCommand: () => calls.push("command")
    };
    const File = function File(path) {
      this.name = String(path).split("/").pop();
      this.exists = true;
    };
    const runSearchScript = await loadResourceAction("runSearchScript", {
      app,
      File
    });
    const originalDollar = globalThis.$;
    globalThis.$ = { evalFile: () => calls.push("eval") };
    try {
      const payload = encodeURIComponent(JSON.stringify({
        path: "C:/Panels/Missing.jsx",
        resourceType: "panel"
      }));
      expect(JSON.parse(runSearchScript(payload))).toEqual({
        ok: false,
        reason: "panel-not-registered"
      });
      expect(calls).toEqual([]);
    } finally {
      globalThis.$ = originalDollar;
    }
  });

  it("evaluates a startup resource exactly once", async () => {
    const evaluated = [];
    const File = function File(path) {
      this.path = String(path);
      this.name = this.path.split("/").pop();
      this.exists = true;
    };
    const runSearchScript = await loadResourceAction("runSearchScript", {
      app: {},
      File
    });
    const originalDollar = globalThis.$;
    globalThis.$ = { evalFile: (file) => evaluated.push(file.path) };
    try {
      const payload = encodeURIComponent(JSON.stringify({
        path: "C:/Startup/Boot.jsx",
        resourceType: "startup"
      }));
      expect(JSON.parse(runSearchScript(payload))).toEqual({ ok: true });
      expect(evaluated).toEqual(["C:/Startup/Boot.jsx"]);
    } finally {
      globalThis.$ = originalDollar;
    }
  });

  it("reports the number of layers that receive a preset", async () => {
    const applied = [];
    const undoGroups = [];
    const layers = [
      { applyPreset: (file) => applied.push(`one:${file.path}`) },
      { applyPreset: (file) => applied.push(`two:${file.path}`) }
    ];
    const app = {
      project: { activeItem: { selectedLayers: layers } },
      beginUndoGroup: (name) => undoGroups.push(`begin:${name}`),
      endUndoGroup: () => undoGroups.push("end")
    };
    const File = function File(path) {
      this.path = String(path);
      this.exists = true;
    };
    const applySearchPreset = await loadResourceAction("applySearchPreset", {
      app,
      File
    });
    const payload = encodeURIComponent(JSON.stringify({ path: "C:/Presets/Bounce.ffx" }));
    expect(JSON.parse(applySearchPreset(payload))).toEqual({
      ok: true,
      updatedItems: 2
    });
    expect(applied).toEqual([
      "one:C:/Presets/Bounce.ffx",
      "two:C:/Presets/Bounce.ffx"
    ]);
    expect(undoGroups).toEqual(["begin:NYAWORKS Apply Preset", "end"]);
  });

  it("closes the expression undo group when assignment throws", async () => {
    const undoGroups = [];
    const property = { canSetExpression: true };
    Object.defineProperty(property, "expression", {
      set() {
        throw new Error("write failed");
      }
    });
    const app = {
      project: { activeItem: { selectedProperties: [property] } },
      beginUndoGroup: (name) => undoGroups.push(`begin:${name}`),
      endUndoGroup: () => undoGroups.push("end")
    };
    const File = function File() {
      this.name = "Broken.txt";
      this.exists = true;
      this.opened = false;
      this.open = () => { this.opened = true; return true; };
      this.read = () => "value * 2";
      this.close = () => { this.opened = false; };
    };
    const applyResourceExpression = await loadResourceAction("applyResourceExpression", {
      app,
      File
    });
    const payload = encodeURIComponent(JSON.stringify({ path: "C:/Expressions/Broken.txt" }));
    expect(JSON.parse(applyResourceExpression(payload))).toMatchObject({
      ok: false,
      reason: "host-error"
    });
    expect(undoGroups).toEqual(["begin:NYAWORKS Apply Expression", "end"]);
  });
});
