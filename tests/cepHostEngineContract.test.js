import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("CEP host engine contract", () => {
  it("registers NYAWORKS in the default CEP ExtendScript engine", async () => {
    const source = await readFile("public/host/index.jsx", "utf8");
    expect(source).not.toMatch(/^\s*#targetengine\b/m);
  });
});
