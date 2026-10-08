import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

async function probeFor(app) {
  const source = await readFile("scripts/ae-tests/pseudo-effect-template-probe.jsx", "utf8");
  return runInNewContext(source, { app }, { timeout: 1000 });
}

function testApp({ version = "25.6.0", count = 0, saved = false } = {}) {
  const calls = [];
  const app = {
    version,
    project: {
      numItems: count,
      file: saved ? { fsName: "user.aep" } : null,
      items: { addComp() { calls.push("addComp"); throw new Error("fixture-create-failed"); } }
    },
    beginUndoGroup() { calls.push("begin"); },
    endUndoGroup() { calls.push("end"); }
  };
  return { app, calls };
}

const options = () => ({
  expectedMajorVersion: 25,
  presetFile: { exists: true, fsName: "owned-test.ffx" }
});

describe("pseudo-effect host probe safety", () => {
  it("refuses a nonempty project before any project mutation", async () => {
    const { app, calls } = testApp({ count: 3 });
    const run = await probeFor(app);
    expect(run(options())).toMatchObject({ ok: false, code: "PROBE_PROJECT_NOT_EMPTY" });
    expect(calls).toEqual([]);
  });

  it("refuses even a saved empty user project", async () => {
    const { app, calls } = testApp({ saved: true });
    const run = await probeFor(app);
    expect(run(options())).toMatchObject({ ok: false, code: "PROBE_PROJECT_NOT_EMPTY" });
    expect(calls).toEqual([]);
  });

  it("refuses a script routed to the wrong AE version", async () => {
    const { app, calls } = testApp({ version: "23.6.0" });
    const run = await probeFor(app);
    expect(run(options())).toMatchObject({ ok: false, code: "PROBE_WRONG_HOST" });
    expect(calls).toEqual([]);
  });

  it("requires an explicit expected version and an existing preset before mutation", async () => {
    const { app, calls } = testApp();
    const run = await probeFor(app);
    expect(run({ presetFile: options().presetFile })).toMatchObject({ ok: false, code: "PROBE_WRONG_HOST" });
    expect(run({ ...options(), presetFile: { exists: false } })).toMatchObject({ ok: false, code: "PROBE_ASSET_MISSING" });
    expect(calls).toEqual([]);
  });

  it("closes its undo group on creation failure and does not replace the project", async () => {
    const { app, calls } = testApp();
    const run = await probeFor(app);
    expect(run(options())).toMatchObject({ ok: false, code: "PROBE_FAILED", message: "fixture-create-failed" });
    expect(calls).toEqual(["begin", "addComp", "end"]);
  });

  it("reports actual loaded parameter identity, value and animation capability", async () => {
    const { app, calls } = testApp();
    const parameter = {
      name: "Width", matchName: "Pseudo/probe-0001", propertyIndex: 1,
      propertyType: 1, propertyValueType: 2, numProperties: 0, value: 500,
      hasMin: true, minValue: 0, hasMax: true, maxValue: 10000,
      canVaryOverTime: true, canSetExpression: true, numKeys: 0, expression: "", unitsText: "pixels"
    };
    const effect = {
      name: "Probe", matchName: "Pseudo/probe", propertyIndex: 1,
      propertyType: 3, numProperties: 1,
      property(index) { if (index === 1) return parameter; throw new Error("bad parameter"); }
    };
    const parade = { numProperties: 0, property(index) { return index === 1 ? effect : null; } };
    const layer = {
      selected: false,
      property(name) { return name === "ADBE Effect Parade" ? parade : null; },
      applyPreset(file) {
        expect(this.selected).toBe(true);
        expect(file).toEqual(options().presetFile);
        parade.numProperties = 1;
      }
    };
    const comp = {
      id: 210,
      name: "__NYA_PSEUDO_PROBE__",
      layers: { addShape() { return layer; } },
      remove() { calls.push("removeComp"); }
    };
    app.project.items.addComp = () => comp;
    const run = await probeFor(app);
    const result = run(options());
    expect(result).toMatchObject({ ok: true, version: "25.6.0", effectCount: 1, compId: 210 });
    expect(result.effects[0]).toMatchObject({
      matchName: "Pseudo/probe",
      children: [{ name: "Width", matchName: "Pseudo/probe-0001", index: 1, value: 500, canVaryOverTime: true, units: "pixels" }]
    });
    expect(calls).toEqual(["begin", "end"]);
  });

  it("removes only its own temporary comp when preset application fails", async () => {
    const { app, calls } = testApp();
    app.project.items.addComp = () => ({
      layers: { addShape: () => ({ applyPreset() { throw new Error("bad-preset"); } }) },
      remove() { calls.push("removeComp"); }
    });
    const run = await probeFor(app);
    expect(run(options())).toMatchObject({ ok: false, code: "PROBE_FAILED", message: "bad-preset" });
    expect(calls).toEqual(["begin", "removeComp", "end"]);
  });
});
