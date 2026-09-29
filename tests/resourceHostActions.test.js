import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function loadApplyResourceExpression({ app, File }) {
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
return applyResourceExpression;`
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
    const applyResourceExpression = await loadApplyResourceExpression({
      app,
      File
    });
    const payload = encodeURIComponent(
      JSON.stringify({ path: "C:/Expressions/Scale.txt" })
    );

    expect(JSON.parse(applyResourceExpression(payload))).toEqual({
      ok: true,
      updatedProperties: 2
    });
    expect(firstProperty.expression).toBe("value * 2");
    expect(ignoredProperty.expression).toBe("");
    expect(secondProperty.expression).toBe("value * 2");
    expect(undoGroups).toEqual([
      "begin:NYAWORKS Apply Expression",
      "end"
    ]);
  });
});
