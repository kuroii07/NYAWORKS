import { describe, expect, it } from "vitest";
import {
  REQUIRED_DIST_FILES,
  REQUIRED_EXTENSION_IDS
} from "../scripts/dist-contract.mjs";

describe("Nya Pie build contract", () => {
  it("ships both CEP entry pages and the shared host script", () => {
    expect(REQUIRED_DIST_FILES).toEqual(
      expect.arrayContaining([
        "dist/index.html",
        "dist/nya-pie-runtime.html",
        "dist/CSXS/manifest.xml",
        "dist/host/index.jsx"
      ])
    );
  });

  it("requires both extension ids in the built manifest", () => {
    expect(REQUIRED_EXTENSION_IDS).toEqual([
      "com.kuroii.nyaworks.panel",
      "com.kuroii.nyaworks.nyapie.p0"
    ]);
  });
});
