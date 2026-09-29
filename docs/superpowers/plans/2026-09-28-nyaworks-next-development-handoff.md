# NYAWORKS Next Development Handoff Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the existing AE alignment tools first, then collect the remaining Nya Pie P0 field evidence before deciding whether the Windows-native NyaLauncher P1 should continue.

**Architecture:** Keep React UI, the CEP bridge, and ExtendScript host logic separate. The normal Nya Pie Runtime remains CEP-owned; a Windows-native process may only supply hotkey, cursor, and window-placement capabilities after CEP-only evidence proves they are required.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, CEP 11, ExtendScript, After Effects 2022-2026, and optional Windows-only .NET 10 / Win32 for NyaLauncher P1.

**Baseline:** `feature/settings-updates` at `94031bb`. Run `git status --short --branch` before work; preserve unrelated user changes.

## Global Constraints

- Do not treat browser tests, TypeScript checks, or a successful Vite build as proof of AE Host behavior.
- Keep the nine-cell alignment grid visually unchanged: no target selector, label row, or layout-height increase.
- Alignment semantics are fixed: normal click aligns to the selected layers' union bounds; `Alt` or `Shift` click aligns to the composition bounds.
- Use AE match names and stable API paths, never localized UI names.
- Do not copy third-party commercial source. Existing behavior research may inform an independent implementation only.
- Do not begin NyaLauncher P1 wiring until P0 latency/DPI/multi-monitor evidence is recorded and the user confirms the native-helper route.
- Never overwrite the user-facing CEP test build under `release/` merely because `dist/` has changed; package a new explicit test build only after AE acceptance.

## Review Focus

- Multiple selected layers: each layer must move relative to one pre-move union snapshot, never a union recalculated after an earlier layer moved.
- Text, shape, footage, rotated, scaled, parented, and ordinary 3D layers must return a useful result or a specific failure; no silent no-op.
- Paragraph alignment must mutate `TextDocument.justification` and be visible on both point text and box text.
- `Alt`/`Shift` must never change the grid layout and must select composition bounds only for layer alignment, not paragraph alignment.
- CEP-only Nya Pie evidence must distinguish a successful shortcut/action chain from missing global cursor, borderless placement, DPI, and latency behavior.

## Work Package A: Alignment Nine-Grid Stabilization

**Files:**
- Modify: `public/host/index.jsx`
- Modify: `src/host/alignmentBridge.ts` only if structured host diagnostics require a typed result change
- Modify: `src/pages/HomePage.tsx` only for user-visible failure mapping or modifier semantics; do not alter grid geometry
- Modify: `README.md` to correct the stale default-target description
- Modify: `planning/02-roadmap.md`
- Create: `docs/testing/alignment-ae-test.md`
- Test: `tests/alignmentBridge.test.ts`, `tests/hostScriptCompatibility.test.js`, and focused new tests where a browser-visible contract changes

**Interfaces:**
- Consumes: `alignmentHostBridge.applyAlignment(action, target)` and `NYAWORKS.setAlignment(encodedPayload)`.
- Produces: an independent host implementation returning `{ ok, updatedLayers }` or a specific reason/detail for failure.

- [ ] **Step 1: Capture the current failure matrix in AE before changing code**

Create `docs/testing/alignment-ae-test.md`. Compare NYAWORKS against AE's native Align panel for one text layer, two text/shape layers, and two ordinary 3D layers. Record action, target, layer types, expected final bounds, actual final bounds, and the Host error detail. Cover all six layer actions plus three paragraph actions.

- [ ] **Step 2: Add or update focused bridge and host-contract tests**

Run: `npm.cmd test -- --run tests/alignmentBridge.test.ts tests/hostScriptCompatibility.test.js`

Assert the encoded payload keeps normal click target `selection`, modifier target `composition`, all nine action IDs remain available, and the host source exposes `NYAWORKS.setAlignment`. Do not fake AE geometry acceptance with string-only tests.

- [ ] **Step 3: Implement one immutable comp-space bounds path in `public/host/index.jsx`**

Use `sourceRectAtTime(time, true)` and project all four rectangle corners with `layer.toComp()`. Build one union from every selected layer before moving any layer. Use that fixed union as the `selection` reference for the entire operation. Preserve the existing composition reference `{ left: 0, top: 0, right: comp.width, bottom: comp.height }`.

- [ ] **Step 4: Correct position conversion by layer class**

Keep the direct unparented 2D path only where it matches AE native output. For parented, rotated, scaled, or 3D layers, convert desired comp-space movement to the correct layer-space Position change; preserve Z for 3D layers and support separated Position dimensions. Return `unsupported-layer` or a typed conversion failure only when AE cannot provide the necessary transform information.

- [ ] **Step 5: Implement paragraph alignment against the stable TextDocument path**

Resolve the text document from `layer.property("ADBE Text Properties").property("ADBE Text Document")`, set `ParagraphJustification.LEFT_JUSTIFY`, `CENTER_JUSTIFY`, or `RIGHT_JUSTIFY`, write it back, and read it back once. Maintain the existing `no-text-layer`, `locked-layer`, and expression/host-error semantics. Do not add a visible target mode for paragraph actions.

- [ ] **Step 6: Run automated checks**

Run: `npm.cmd run verify`

Expected: all tests, typecheck, two-entry CEP build, and dist smoke check pass.

- [ ] **Step 7: Run the real AE acceptance matrix and update the test record**

For every one of the six layer actions, compare selection and composition results against the native AE Align panel. Test point text and box text for the three paragraph actions. Add 2D/3D, parented, rotated/scaled, locked, keyframed, and expression cases; clearly mark unsupported cases rather than claiming support. Capture screenshots only for actual discrepancies or accepted reference cases.

- [ ] **Step 8: Commit the complete alignment increment**

```powershell
git add public/host/index.jsx src/host/alignmentBridge.ts src/pages/HomePage.tsx README.md planning/02-roadmap.md docs/testing/alignment-ae-test.md tests
git commit -m "fix: stabilize AE alignment actions"
```

## Work Package B: Nya Pie P0 Field Acceptance

**Files:**
- Modify: `docs/testing/nya-pie-p0-ae-test.md`
- Modify only when a test exposes a reproducible defect: `src/nyaPie/p0/NyaPieP0Runtime.tsx`, `src/nyaPie/p0/runtimeController.ts`, `src/nyaPie/p0/cepLauncher.ts`, or their focused tests

**Interfaces:**
- Consumes: AE Keyboard Shortcuts assignment for `NYAWORKS · Nya Pie P0` and the existing CEP Runtime.
- Produces: a measured decision record: CEP-only sufficient for the next P1 UX iteration, or a justified native-helper gap list.

- [ ] **Step 1: Measure the five existing focus scenarios**

Use Composition, Timeline, Project, Effect Controls, and NYAWORKS Panel focus. For each, record 10 cold/warm shortcut opens, KeyUp execution, close behavior, and focus return. Fill the currently pending rows rather than replacing them with a blanket “passed”.

- [ ] **Step 2: Complete the Windows matrix without code changes**

Record 100%, 125%, 150%, and 200% DPI where available; same-DPI and mixed-DPI dual displays; each screen edge; ten rapid invocations; AE minimized; AE not foreground; and shortcut conflicts. State exact observations and timing ranges.

- [ ] **Step 3: Classify failures before coding**

For every failure, state whether it is a CEP Runtime bug, an AE shortcut limitation, a missing CEP capability, or a final-product UX mismatch. Do not introduce a global hook, IPC server, or native executable merely to hide an unmeasured delay.

- [ ] **Step 4: Make the decision gate explicit**

If the P0 record shows acceptable shortcut/action reliability but cannot provide borderless cursor-near placement, prepare a short user decision: keep CEP-only P1 with a fixed modeless window, or approve NyaLauncher P1 to supply native placement. Stop after presenting this decision.

## Work Package C: NyaLauncher P1 (Only After Approval)

**Files:**
- Existing implementation plan: `docs/superpowers/plans/2026-09-28-nya-launcher-p1.md`
- Existing design: `docs/superpowers/specs/2026-09-28-nya-launcher-p1-design.md`
- Existing project: `native/NyaLauncher/`

**Interfaces:**
- Consumes: the P0 field-evidence decision and a Windows-only user approval.
- Produces: a narrow helper that observes the approved shortcut while AE is foreground, finds the P1 Runtime window, removes its frame, and places it near the captured cursor. It must not execute AE tools itself or create a second Pie UI.

- [ ] **Step 1: Bootstrap and verify the exact SDK**

Run `powershell -ExecutionPolicy Bypass -File scripts/bootstrap-nya-launcher-sdk.ps1`, then `powershell -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1`. The project requires SDK `10.0.100` from `global.json`; report installation or restore failures before changing source.

- [ ] **Step 2: Execute Tasks 5–7 from the existing P1 plan in order**

Implement the Runtime detector/position coordinator, then Hook and application wiring, then CEP title marker/build candidate. Do not skip directly from existing interop declarations to a release executable: `Program.cs` currently only initializes WinForms and does not wire any of the prepared boundaries.

- [ ] **Step 3: Run native, JavaScript, and real AE verification separately**

Run `scripts/test-nya-launcher.ps1`, `npm.cmd run verify`, and the P1 AE matrix. State separately whether native unit tests, CEP build tests, and AE behavior passed.

- [ ] **Step 4: Package only a Windows test candidate**

Use `scripts/build-nya-launcher.ps1` only after the preceding checks pass. Label the output Windows-only P1 candidate; do not call it a cross-platform release and do not change the main extension install flow yet.

## Work Package D: Resource Actions (After Spatial Tools and Pie Decision)

**Files to plan before implementation:**
- `public/host/index.jsx`
- `src/host/resourceBridge.ts`
- resource pages/providers under `src/`
- `docs/testing/`

- [ ] **Step 1: Write a dedicated resource-action specification**

Separate script execution, preset application, effect application, and expression writing. Define the trust prompt, undo policy, invalid-file behavior, and per-action AE acceptance test before adding any execution button.

- [ ] **Step 2: Implement one action category at a time**

Start with local `.jsx` execution from an enabled source. Require an explicit trust/confirmation flow, `app.beginUndoGroup`, structured host results, and a real AE test record. Do not batch script, preset, effect, and expression actions into one opaque “use resource” command.

## Completion Criteria

- Work Package A is accepted only when the saved AE matrix matches native AE for supported cases and reports specific failures for unsupported cases.
- Work Package B is accepted only when the test record contains measured latency/environment evidence and a clear CEP-only versus native-helper decision.
- Work Package C is optional and requires user approval after Work Package B.
- Work Package D starts only with its own confirmed specification.

