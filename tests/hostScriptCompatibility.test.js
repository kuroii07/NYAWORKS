import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("CEP host script compatibility", () => {
  it("uses ExtendScript-safe file extension parsing", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");

    expect(source).toContain('safeFilename.lastIndexOf(".")');
    expect(source).not.toContain("filename.match(/\\.([^.\\\\/]+)$/)");
    expect(source).not.toContain("instanceof AVLayer");
  });

  it("keeps a deterministic 2D bounds fallback for AE text layers", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");

    expect(source).toContain("function readFallback2dCompBounds");
    expect(source).toContain("fallback = readFallback2dCompBounds(layer, rect);");
    expect(source).toContain("if (fallback) return fallback;");
  });

  it("writes paragraph alignment through the stable Source Text alias first", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");

    expect(source).toContain('layer.property("Source Text")');
    expect(source).toContain('layer.property("ADBE Text Properties")');
  });
});
