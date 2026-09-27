import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/pages/HomePage.tsx", import.meta.url), "utf8");

describe("spatial quick tool tooltips", () => {
  it("uses translated labels for anchor and alignment buttons", () => {
    expect(source).toContain("copy.spatialPositionLabels[position]");
    expect(source).toContain("copy.alignPositionLabels[position]");
    expect(source).toContain("title={tooltip}");
    expect(source).toContain("align-grid-icon--paragraph");
    expect(source).toContain("align-grid-icon--layer");
  });

  it("keeps six layer alignment actions and three paragraph actions in one grid", () => {
    expect(source.match(/kind: "layer",/g)).toHaveLength(6);
    expect(source.match(/kind: "paragraph",/g)).toHaveLength(3);
  });

  it("uses a modifier click instead of adding controls to the fixed grid", () => {
    expect(source).toContain("event.altKey || event.shiftKey");
    expect(source).toContain('"composition" : "selection"');
    expect(source).not.toContain("alignment-target-row");
  });

  it("does not render the old bottom action feedback block", () => {
    expect(source).not.toContain("spatial-action-feedback");
    expect(source).not.toContain("anchorFeedback ?");
  });
});
