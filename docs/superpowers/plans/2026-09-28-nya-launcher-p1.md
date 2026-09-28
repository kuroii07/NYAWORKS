# NyaLauncher P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Windows NyaLauncher that observes the existing AE `Alt + Space` shortcut, captures cursor position, strips and positions the existing CEP Nya Pie Runtime window, and leaves all UI and Action execution inside NYAWORKS.

**Architecture:** A hidden C# WinForms message-loop process installs a pass-through low-level keyboard hook, verifies After Effects is foreground, captures the cursor, detects the uniquely titled CEP Runtime window, and applies Win32 style/position changes. Pure state, geometry, process, and window-selection logic remain testable behind focused interfaces; no IPC, WebView, input injection, or native Action logic is introduced.

**Tech Stack:** C# / .NET 10 Windows Desktop / WinForms `ApplicationContext` / Win32 P/Invoke / xUnit / PowerShell / existing React + TypeScript CEP Runtime

**Spec:** `docs/superpowers/specs/2026-09-28-nya-launcher-p1-design.md`

## Global Constraints

- Windows P1 only; existing product target remains After Effects 2022–2026.
- NyaLauncher may observe keyboard input, inspect AE foreground state, capture cursor position, identify/style/position the CEP Runtime window, and write diagnostics only.
- NyaLauncher must never execute Actions, ExtendScript, UI logic, profiles, or settings.
- The keyboard hook must call `CallNextHookEx` and must not consume `Alt + Space`.
- No WebView2, localhost server, WebSocket, input simulation, DLL injection, admin rights, installer, auto-start, or updater.
- The existing React/CEP Runtime remains the only Pie UI and the existing Action Runner remains the only Action execution path.
- Use a repository-local .NET SDK and NuGet cache; do not modify system PATH or require Visual Studio.
- Keep automated verification separate from real AE acceptance.

## Review Focus

- A repeated or auto-repeated `Alt + Space` KeyDown must create only one launch session and one window mutation.
- A negative-coordinate secondary monitor must center and clamp the Runtime without moving it onto the primary monitor.
- A title collision from an unrelated process must never cause that window to be restyled.
- `SWP_NOACTIVATE` and style changes must not break CEP KeyUp execution or AE focus restoration.
- Launcher absence or Runtime discovery timeout must preserve the current CEP fallback and must never hang AE.

---

### Task 1: Local .NET toolchain and project contract

**Files:**
- Modify: `.gitignore`
- Create: `global.json`
- Create: `native/NyaLauncher/NyaLauncher.slnx`
- Create: `native/NyaLauncher/Directory.Build.props`
- Create: `native/NyaLauncher/Directory.Packages.props`
- Create: `native/NyaLauncher/src/NyaLauncher/NyaLauncher.csproj`
- Create: `native/NyaLauncher/src/NyaLauncher/Program.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/NyaLauncher.Tests.csproj`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/ProjectSmokeTests.cs`
- Create: `scripts/bootstrap-nya-launcher-sdk.ps1`
- Create: `scripts/test-nya-launcher.ps1`
- Create: `scripts/build-nya-launcher.ps1`
- Create: `tests/nyaLauncherProjectContract.test.js`

**Interfaces:**
- Produces: repository-local `.dotnet/dotnet.exe`, solution `native/NyaLauncher/NyaLauncher.slnx`, `scripts/test-nya-launcher.ps1`, and `scripts/build-nya-launcher.ps1`.
- Package versions: `Microsoft.NET.Test.Sdk` `18.9.0`, `xunit` `2.9.3`, `xunit.runner.visualstudio` `3.1.5`.

- [ ] **Step 1: Write the failing Node project-contract test**

Add tests asserting:

- `global.json` requests SDK `10.0.100` with `rollForward: latestFeature`;
- the application and test projects target `net10.0-windows`;
- the application is `WinExe`, enables WinForms, nullable, implicit usings, and unsafe blocks;
- prohibited package names `WebView2`, `HttpListener`, and `WebSocket` are absent;
- bootstrap/test/build scripts exist;
- `.gitignore` excludes `.dotnet/`, `.nuget/`, native `bin/obj`, and `outputs/nya-launcher-p1/`.

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
npm.cmd test -- tests/nyaLauncherProjectContract.test.js
```

Expected: FAIL because the native project and scripts do not exist.

- [ ] **Step 3: Create the minimal project and scripts**

`bootstrap-nya-launcher-sdk.ps1` must:

- resolve the repository root;
- install the official .NET `10.0` GA channel into `.dotnet`;
- use `.nuget/packages` as `NUGET_PACKAGES`;
- do nothing when an acceptable local `10.*` SDK already exists;
- leave system PATH unchanged.

`test-nya-launcher.ps1` must run:

```powershell
.dotnet\dotnet.exe test native\NyaLauncher\NyaLauncher.slnx --configuration Release
```

It must accept optional remaining arguments such as `--filter` and forward them unchanged to `dotnet test`.

`build-nya-launcher.ps1` must publish `win-x64`, self-contained, single-file output to `outputs/nya-launcher-p1`.

- [ ] **Step 4: Run the Node contract test and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/nyaLauncherProjectContract.test.js
```

Expected: PASS.

- [ ] **Step 5: Bootstrap the local SDK and run the smoke test**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-nya-launcher-sdk.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1
```

Expected: local `dotnet --version` begins with `10.` and `ProjectSmokeTests` passes.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore global.json native/NyaLauncher scripts/bootstrap-nya-launcher-sdk.ps1 scripts/test-nya-launcher.ps1 scripts/build-nya-launcher.ps1 tests/nyaLauncherProjectContract.test.js
git commit -m "build: scaffold NyaLauncher P1"
```

### Task 2: Shortcut launch state machine

**Files:**
- Create: `native/NyaLauncher/src/NyaLauncher/Input/ShortcutStateMachine.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Model/LaunchPhase.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Model/LaunchSession.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Model/ScreenPoint.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/ShortcutStateMachineTests.cs`

**Interfaces:**
- Produces:
  - `enum LaunchPhase { Idle, WaitingForRuntime, RuntimePositioned }`
  - `readonly record struct ScreenPoint(int X, int Y)`
  - `sealed record LaunchSession(long Sequence, int AeProcessId, ScreenPoint Cursor, long KeyDownTicks, nint RuntimeWindow, long? FoundTicks, long? PositionedTicks, long? KeyUpTicks)`
  - `sealed class ShortcutStateMachine`
  - `bool TryArm(bool isAeForeground, bool altDown, uint virtualKey, int aeProcessId, ScreenPoint cursor, long timestampTicks)`
  - `bool TryMarkRuntimePositioned(nint hwnd, long foundTicks, long positionedTicks)`
  - `bool TryRelease(uint virtualKey, long timestampTicks)`
  - `void Reset()`
  - `LaunchPhase Phase { get; }`
  - `LaunchSession? Current { get; }`

- [ ] **Step 1: Write failing state-machine tests**

Cover:

- AE foreground + Alt + `VK_SPACE` arms one session;
- non-AE foreground does not arm;
- missing Alt does not arm;
- key auto-repeat does not replace cursor or sequence;
- Runtime position transition stores HWND and timestamps;
- Space or Alt KeyUp records release and returns to Idle;
- timeout reset returns to Idle;
- stale position callbacks are rejected after reset.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter ShortcutStateMachineTests
```

Expected: FAIL because state-machine types do not exist.

- [ ] **Step 3: Implement the minimal state machine**

Use constants `VK_SPACE = 0x20` and `VK_MENU = 0x12`. Do not call Win32 from this class.

- [ ] **Step 4: Run the tests and verify GREEN**

Run the same filtered command.

Expected: all `ShortcutStateMachineTests` pass.

- [ ] **Step 5: Commit**

```powershell
git add native/NyaLauncher/src/NyaLauncher/Input native/NyaLauncher/src/NyaLauncher/Model native/NyaLauncher/tests/NyaLauncher.Tests/ShortcutStateMachineTests.cs
git commit -m "feat: add NyaLauncher shortcut state"
```

### Task 3: Monitor-aware window placement

**Files:**
- Create: `native/NyaLauncher/src/NyaLauncher/Model/ScreenRect.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Model/ScreenSize.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Model/WindowPlacement.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Runtime/RuntimeWindowPositioner.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowPositionerTests.cs`

**Interfaces:**
- Produces:
  - `readonly record struct ScreenRect(int Left, int Top, int Right, int Bottom)`
  - `readonly record struct ScreenSize(int Width, int Height)`
  - `readonly record struct WindowPlacement(int X, int Y, int Width, int Height)`
  - `static WindowPlacement Calculate(ScreenPoint cursor, ScreenSize runtimeSize, ScreenRect workArea)`

- [ ] **Step 1: Write failing placement tests**

Cover:

- 220×220 window centers on a cursor in the middle of the work area;
- left/right/top/bottom edges clamp independently;
- all four corners clamp;
- negative-coordinate secondary monitor remains on that monitor;
- non-zero work-area origin is preserved;
- a Runtime larger than the work area anchors to the work-area origin and uses its requested size.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter RuntimeWindowPositionerTests
```

Expected: FAIL because placement types do not exist.

- [ ] **Step 3: Implement the pure placement function**

Center using integer coordinates, then clamp X and Y independently to `[workArea.Left, workArea.Right - width]` and `[workArea.Top, workArea.Bottom - height]`, with the work-area origin as the fallback when the maximum is below the minimum.

- [ ] **Step 4: Run the tests and verify GREEN**

Run the same filtered command.

Expected: all placement tests pass.

- [ ] **Step 5: Commit**

```powershell
git add native/NyaLauncher/src/NyaLauncher/Model native/NyaLauncher/src/NyaLauncher/Runtime/RuntimeWindowPositioner.cs native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowPositionerTests.cs
git commit -m "feat: add monitor-aware runtime placement"
```

### Task 4: Win32 boundary and AE foreground guard

**Files:**
- Create: `native/NyaLauncher/src/NyaLauncher/Interop/NativeConstants.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Interop/NativeStructs.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Interop/NativeMethods.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Interop/INativeWindowApi.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Interop/NativeWindowApi.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Ae/IProcessCatalog.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Ae/ProcessCatalog.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Ae/AeForegroundGuard.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/AeForegroundGuardTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/NativeConstantsTests.cs`

**Interfaces:**
- `INativeWindowApi` produces foreground HWND/PID, cursor position, monitor work area, top-level window enumeration, window text, visibility, style access, positioning, hook APIs, and last Win32 error.
- `IProcessCatalog` produces `string? GetProcessName(int processId)` and `bool IsDescendantOf(int processId, int ancestorProcessId)`.
- `AeForegroundGuard.TryGetForegroundAe(out int processId)` returns true only for process name `AfterFX`.

- [ ] **Step 1: Write failing guard and constant tests**

Cover:

- exact `AfterFX` match is accepted case-insensitively;
- `CEPHtmlEngine`, `explorer`, missing PID, and zero HWND are rejected;
- constants pin `WH_KEYBOARD_LL`, `VK_SPACE`, `VK_MENU`, style masks, `EVENT_OBJECT_SHOW`, `SWP_FRAMECHANGED`, and `SWP_NOACTIVATE`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter "AeForegroundGuardTests|NativeConstantsTests"
```

Expected: FAIL because the interop boundary and guard do not exist.

- [ ] **Step 3: Implement the interfaces and P/Invoke declarations**

Declare only APIs required by the spec:

- keyboard hook installation/removal and `CallNextHookEx`;
- foreground/PID/cursor;
- window enumeration/text/visibility;
- window style get/set;
- `SetWindowPos`;
- monitor lookup/info;
- `SetWinEventHook` / `UnhookWinEvent`;
- process snapshot APIs for ancestry;
- Per-Monitor V2 DPI awareness.

- [ ] **Step 4: Implement `AeForegroundGuard` and `ProcessCatalog`**

Keep process lookup behind `IProcessCatalog`; catch process-exit races and return false.

- [ ] **Step 5: Run the tests and verify GREEN**

Run the same filtered command.

Expected: all guard and constant tests pass.

- [ ] **Step 6: Commit**

```powershell
git add native/NyaLauncher/src/NyaLauncher/Interop native/NyaLauncher/src/NyaLauncher/Ae native/NyaLauncher/tests/NyaLauncher.Tests/AeForegroundGuardTests.cs native/NyaLauncher/tests/NyaLauncher.Tests/NativeConstantsTests.cs
git commit -m "feat: add NyaLauncher Win32 boundary"
```

### Task 5: Runtime detection, validation, styling, and positioning

**Files:**
- Create: `native/NyaLauncher/src/NyaLauncher/Runtime/RuntimeWindowCandidate.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Runtime/RuntimeWindowDetector.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Runtime/RuntimeWindowStyler.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Runtime/RuntimeWindowCoordinator.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowDetectorTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowStylerTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowCoordinatorTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/NativeWindowIntegrationTests.cs`

**Interfaces:**
- Runtime marker: `NYAWORKS_NYA_PIE_RUNTIME_P1`.
- `RuntimeWindowDetector.TryFind(int aeProcessId, string exactTitle, out RuntimeWindowCandidate candidate)`.
- Candidate validation requires visible top-level window, exact title, process name `CEPHtmlEngine`, and descendant relationship to the active AE PID.
- `RuntimeWindowStyler.TryApply(nint hwnd)` removes caption/frame/system styles, adds `WS_EX_TOOLWINDOW`, and applies `SWP_FRAMECHANGED`.
- `RuntimeWindowCoordinator.TryPosition(LaunchSession session)` resolves monitor work area, calculates placement, styles once, and calls `SetWindowPos` with `SWP_NOACTIVATE`.

- [ ] **Step 1: Write failing detector tests**

Cover:

- exact candidate accepted;
- wrong title, invisible window, wrong process, unrelated process tree, zero HWND, and duplicate candidates rejected;
- unrelated title collision is never mutated.

- [ ] **Step 2: Run detector tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter RuntimeWindowDetectorTests
```

Expected: FAIL because detector types do not exist.

- [ ] **Step 3: Implement the detector**

Use `EnumWindows` as the deterministic testable path. WinEvent notifications in Task 6 trigger this same detector rather than duplicating candidate logic.

- [ ] **Step 4: Write failing styling/coordinator tests**

Assert:

- exact style bits removed and `WS_EX_TOOLWINDOW` added;
- failed style mutation stops before positioning;
- monitor work area and 220×220 size reach the pure positioner;
- `SetWindowPos` includes frame-changed/no-activate flags;
- a session already positioned is not mutated twice;
- negative-coordinate placement is passed unchanged.

- [ ] **Step 5: Run styling/coordinator tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter "RuntimeWindowStylerTests|RuntimeWindowCoordinatorTests"
```

Expected: FAIL because styling/coordinator types do not exist.

- [ ] **Step 6: Implement styling and coordination**

Do not activate the Launcher or execute any CEP Action.

- [ ] **Step 7: Run all Task 5 tests and verify GREEN**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter "RuntimeWindowDetectorTests|RuntimeWindowStylerTests|RuntimeWindowCoordinatorTests"
```

Expected: all Task 5 tests pass.

- [ ] **Step 8: Add a Windows test-window integration test**

Create a temporary WinForms window owned by the test process and verify:

- `RuntimeWindowStyler` removes caption/frame styles from the test HWND;
- the coordinator moves it to the requested test-screen placement;
- the test restores/closes its own window even when an assertion fails;
- no unrelated desktop window is enumerated or modified.

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter NativeWindowIntegrationTests
```

Expected: PASS on Windows without After Effects.

- [ ] **Step 9: Commit**

```powershell
git add native/NyaLauncher/src/NyaLauncher/Runtime native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowDetectorTests.cs native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowStylerTests.cs native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowCoordinatorTests.cs native/NyaLauncher/tests/NyaLauncher.Tests/NativeWindowIntegrationTests.cs
git commit -m "feat: position the CEP runtime near the cursor"
```

### Task 6: Keyboard hook, window event hook, diagnostics, and application wiring

**Files:**
- Create: `native/NyaLauncher/src/NyaLauncher/Input/KeyboardHook.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Runtime/RuntimeWindowWatcher.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Diagnostics/ILauncherLog.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Diagnostics/LauncherLog.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/Diagnostics/LaunchTrace.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/SingleInstanceGuard.cs`
- Create: `native/NyaLauncher/src/NyaLauncher/LauncherApplicationContext.cs`
- Modify: `native/NyaLauncher/src/NyaLauncher/Program.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/KeyboardHookTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/KeyboardHookIntegrationTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/RuntimeWindowWatcherTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/LauncherApplicationContextTests.cs`
- Create: `native/NyaLauncher/tests/NyaLauncher.Tests/LauncherLogTests.cs`

**Interfaces:**
- `KeyboardHook.Start(Action<KeyboardSample> callback)` and `Dispose()`.
- `KeyboardSample(uint VirtualKey, bool IsKeyDown, bool IsKeyUp, bool AltDown, long TimestampTicks)`.
- `RuntimeWindowWatcher.Arm(int aeProcessId, long sequence, TimeSpan timeout)` and events `RuntimeShown`, `TimedOut`.
- `ILauncherLog.Write(LaunchTrace trace)` writes one sanitized JSON line.
- `LauncherApplicationContext` owns all hook lifetimes and orchestration.

- [ ] **Step 1: Write failing hook and watcher tests**

Cover:

- key events are forwarded to the callback;
- the native hook callback always delegates to `CallNextHookEx`;
- a real hook can be installed and disposed without leaving a live hook;
- auto-repeat does not cause a second arm;
- WinEvent triggers the shared detector;
- polling fallback stops at 1500ms;
- timeout resets state;
- disposal unhooks keyboard and WinEvent hooks.

- [ ] **Step 2: Run hook/watcher tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter "KeyboardHookTests|KeyboardHookIntegrationTests|RuntimeWindowWatcherTests"
```

Expected: FAIL because hook and watcher types do not exist.

- [ ] **Step 3: Implement hook and watcher**

Keep delegates rooted for the complete hook lifetime. WinEvent callbacks may only signal work; window validation remains in `RuntimeWindowDetector`.

- [ ] **Step 4: Write failing application/log tests**

Cover:

- non-AE shortcut is ignored;
- AE shortcut captures cursor and arms watcher once;
- successful detection records found/positioned timestamps;
- KeyUp records release but never executes an Action;
- timeout returns to Idle;
- single-instance rejection exits cleanly;
- log directory is `%LOCALAPPDATA%\NYAWORKS\logs`;
- logs omit project paths, Action payloads, and API keys.

- [ ] **Step 5: Run application/log tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter "LauncherApplicationContextTests|LauncherLogTests"
```

Expected: FAIL because orchestration and logging do not exist.

- [ ] **Step 6: Implement application wiring**

`Program.Main` must:

- request Per-Monitor V2 DPI awareness;
- acquire the single-instance guard;
- create the hidden `LauncherApplicationContext`;
- return a non-zero exit code only for startup failure;
- never show a form, tray icon, or console window.

- [ ] **Step 7: Run all Task 6 tests and verify GREEN**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1 --filter "KeyboardHookTests|KeyboardHookIntegrationTests|RuntimeWindowWatcherTests|LauncherApplicationContextTests|LauncherLogTests"
```

Expected: all Task 6 tests pass.

- [ ] **Step 8: Commit**

```powershell
git add native/NyaLauncher/src/NyaLauncher native/NyaLauncher/tests/NyaLauncher.Tests
git commit -m "feat: wire the NyaLauncher runtime"
```

### Task 7: CEP Runtime marker, build contract, documentation, and P1 candidate

**Files:**
- Modify: `src/nyaPie/p0/cepLauncher.ts`
- Modify: `src/nyaPie/p0/main.tsx`
- Modify: `tests/nyaPieCepLauncher.test.ts`
- Modify: `tests/nyaPieRuntime.test.tsx`
- Modify: `scripts/smoke-dist.mjs`
- Create: `tests/nyaLauncherBuildContract.test.js`
- Create: `docs/testing/nya-launcher-p1-ae-test.md`
- Modify: `README.md`
- Modify: `planning/02-roadmap.md`

**Interfaces:**
- Add `setWindowTitle(title: string): boolean` to `NyaPieCepLauncher`.
- On Runtime startup set exact marker `NYAWORKS_NYA_PIE_RUNTIME_P1`.
- Native publish artifact: `outputs/nya-launcher-p1/NyaLauncher.exe`.

- [ ] **Step 1: Write failing CEP marker tests**

Assert:

- launcher calls `window.__adobe_cep__.invokeSync("setWindowTitle", marker)`;
- Runtime startup applies the exact P1 marker once;
- browser environment safely returns false without CEP.

- [ ] **Step 2: Run CEP marker tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/nyaPieCepLauncher.test.ts tests/nyaPieRuntime.test.tsx
```

Expected: FAIL because `setWindowTitle` is not implemented.

- [ ] **Step 3: Implement the CEP title marker**

Do not change approved NYAWORKS theme, language, main panel, or Action behavior.

- [ ] **Step 4: Write the failing native build-contract test**

Assert:

- the launcher solution, scripts, executable output, P1 test record, and Runtime marker exist;
- the native source contains no `HttpListener`, `WebSocket`, `SendInput`, `mouse_event`, or Action Registry implementation;
- `scripts/smoke-dist.mjs` continues validating both CEP entries without requiring the native binary inside `dist`.

- [ ] **Step 5: Run the build-contract test and verify RED**

Run:

```powershell
npm.cmd test -- tests/nyaLauncherBuildContract.test.js
```

Expected: FAIL before native publish and documentation are complete.

- [ ] **Step 6: Add documentation and publish the P1 candidate**

The AE test record must distinguish:

- automated C# tests;
- native test-window integration;
- real AE manual checks;
- deferred DPI/multi-monitor checks;
- current known limitations.

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-nya-launcher.ps1
```

Expected: `outputs/nya-launcher-p1/NyaLauncher.exe` exists.

- [ ] **Step 7: Run all focused verification**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1
npm.cmd test -- tests/nyaPieCepLauncher.test.ts tests/nyaPieRuntime.test.tsx tests/nyaLauncherProjectContract.test.js tests/nyaLauncherBuildContract.test.js
```

Expected: all native and focused CEP tests pass.

- [ ] **Step 8: Run complete repository verification**

Run:

```powershell
npm.cmd run verify
```

Expected: TypeScript, full Vitest suite, Vite build, and smoke checks pass.

- [ ] **Step 9: Commit**

```powershell
git add src/nyaPie/p0 tests scripts/smoke-dist.mjs docs/testing/nya-launcher-p1-ae-test.md README.md planning/02-roadmap.md
git commit -m "feat: integrate the NyaLauncher P1 candidate"
```
