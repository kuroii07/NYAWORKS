# NYAWORKS Settings, Updates, Notifications, and Brightness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reset-all-settings, automatic GitHub Release checks, a reusable What's New notification flow, and bounded theme-relative interface brightness to the NYAWORKS CEP panel.

**Architecture:** Extend the existing settings model for persisted preferences, add one reusable modal primitive, and isolate release/version logic under `src/updates/`. `UpdatesProvider` owns update-check and unread-release state; visual components consume that state without performing network calls. The current theme, language, density, and navigation providers remain authoritative for their own preferences.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Phosphor Icons, browser `fetch`, CEP-safe external URL bridge, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-09-24-settings-update-notifications-brightness-design.md`

## Global Constraints

- Keep the existing five dark themes and default `obsidian-cyan`; do not add a light theme.
- Preserve the existing theme and language button behavior.
- Support Simplified Chinese, Traditional Chinese, English, Japanese, and Korean for every new visible string.
- The first update implementation opens the relevant GitHub Release page; it must not download, overwrite, install, or restart After Effects.
- Automatic update checks run once per extension launch only when `autoCheckUpdates` is enabled.
- Choosing “Not now” closes only the current prompt; the next launch checks and prompts again until the installed version is current.
- Brightness is theme-relative, persisted, and clamped to `90–110`, default `100`, step `1`.
- Reset restores UI preferences and the last-page record but never silently deletes user resources or API keys.
- New select-like controls must reuse `src/components/SettingSelect.tsx`; do not introduce native `<select>` elements.
- Browser verification proves rendering and interaction only; CEP/After Effects host behavior remains a separate acceptance gate.
- The repository currently has no initial commit. Before feature commits, create one reviewed baseline commit containing the already-approved project state.

## Review Focus

- GitHub returns `404`, `403`, malformed JSON, a draft release, or a tag such as `v1.2.3-beta.2`: startup remains usable and only a valid newer published release prompts.
- The user closes “Not now” and relaunches without updating: the same newer release prompts again while automatic checks remain enabled.
- Brightness is changed while a custom select or dialog is open: the panel and portal-rendered overlays remain visually consistent.
- Reset is confirmed while non-default theme, language, density, brightness, and navigation state are active: all UI preferences reset once, the app returns home, and no user resource/API-key storage is touched.
- At `420 × 640`, long English/Japanese/Korean copy, the notification badge, sliders, and dialogs remain usable without horizontal overflow or inaccessible actions.

---

## File Structure

### Create

- `src/components/AppDialog.tsx` — accessible shared modal shell.
- `src/components/BrightnessControl.tsx` — themed slider with percentage output.
- `src/components/WhatsNewButton.tsx` — top-bar bell button and unread dot.
- `src/updates/types.ts` — release and update state contracts.
- `src/updates/version.ts` — version normalization and comparison.
- `src/updates/githubReleaseService.ts` — GitHub Release request and response validation.
- `src/updates/releaseNotes.ts` — bundled release notes for installed versions.
- `src/updates/releaseNotesStorage.ts` — last-seen version persistence.
- `src/updates/UpdatesProvider.tsx` — launch check, dialogs, unread state, and public update actions.
- `tests/version.test.ts` — version comparison cases.
- `tests/githubReleaseService.test.ts` — valid, invalid, unavailable, and non-newer release behavior.
- `tests/releaseNotesStorage.test.ts` — unread/seen persistence behavior.

### Modify

- `src/settings/types.ts` — add three persisted preferences and brightness bounds.
- `src/settings/generalSettingsStorage.ts` — normalize and persist new settings.
- `src/settings/SettingsProvider.tsx` — expose `resetGeneralSettings` and apply brightness CSS variable.
- `src/settings/lastPageStorage.ts` — expose last-page clearing.
- `src/theme/ThemeProvider.tsx` — expose `resetTheme`.
- `src/i18n/LanguageProvider.tsx` — expose `resetLanguage`.
- `src/density/DensityProvider.tsx` — expose `resetDensity`.
- `src/i18n/types.ts` — add settings, dialog, update, and notification copy contracts.
- `src/i18n/translations.ts` — provide all new copy in five languages.
- `src/pages/SettingsPage.tsx` — place the four controls and reset confirmation.
- `src/components/TopBar.tsx` — insert `WhatsNewButton` before the theme control.
- `src/App.tsx` — coordinate reset navigation and render global dialogs.
- `src/main.tsx` — mount `UpdatesProvider`.
- `src/styles.css` — sliders, notification badge, modal, brightness, responsive styles.
- `tests/generalSettingsStorage.test.ts` — new defaults, round-trip, and repair cases.
- `tests/translations.test.ts` — new copy completeness.
- `README.md` — document behavior and current limitations.
- `planning/02-roadmap.md` — mark the completed settings increment.

---

### Task 0: Establish the Reviewed Repository Baseline

**Files:**
- Review: all currently untracked project files
- Commit: existing approved project state, specification, and plan

**Interfaces:**
- Consumes: the current verified NYAWORKS working tree.
- Produces: a clean baseline commit from which each feature task can be reviewed independently.

- [ ] **Step 1: Confirm the repository has no existing commit**

Run:

```powershell
git rev-parse --verify HEAD
git status --short
```

Expected: `HEAD` is absent and the project files are untracked.

- [ ] **Step 2: Run the baseline verification**

Run:

```powershell
npm.cmd run verify
git diff --check
```

Expected: all tests, type checking, build, and distribution smoke checks pass.

- [ ] **Step 3: Create the baseline commit**

Run:

```powershell
git add .
git commit -m "chore: establish NYAWORKS baseline"
```

Expected: one root commit containing the approved project state, with no generated dependency folders included.

---

### Task 1: Persist Update, Notification, and Brightness Preferences

**Files:**
- Modify: `src/settings/types.ts`
- Modify: `src/settings/generalSettingsStorage.ts`
- Modify: `src/settings/SettingsProvider.tsx`
- Modify: `tests/generalSettingsStorage.test.ts`

**Interfaces:**
- Consumes: existing `GeneralSettings`, storage normalization, and provider update API.
- Produces:
  - `MIN_INTERFACE_BRIGHTNESS = 90`
  - `MAX_INTERFACE_BRIGHTNESS = 110`
  - `DEFAULT_INTERFACE_BRIGHTNESS = 100`
  - `clampInterfaceBrightness(value: unknown): number`
  - `resetGeneralSettings(): void`

- [ ] **Step 1: Write failing storage tests**

Add literal expectations:

```ts
expect(DEFAULT_GENERAL_SETTINGS).toMatchObject({
  autoCheckUpdates: true,
  showWhatsNew: true,
  interfaceBrightness: 100
});

expect(readStoredGeneralSettings(storage)).toMatchObject({
  autoCheckUpdates: false,
  showWhatsNew: false,
  interfaceBrightness: 110
});
```

Add table-driven repair cases for `89`, `111`, `NaN`, strings, and missing values; every invalid value must resolve to `100`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- tests/generalSettingsStorage.test.ts
```

Expected: FAIL because the three fields and brightness normalization do not exist.

- [ ] **Step 3: Implement the settings fields and normalization**

Add to `GeneralSettings`:

```ts
autoCheckUpdates: boolean;
showWhatsNew: boolean;
interfaceBrightness: number;
```

Use explicit bounds:

```ts
export const MIN_INTERFACE_BRIGHTNESS = 90;
export const MAX_INTERFACE_BRIGHTNESS = 110;
export const DEFAULT_INTERFACE_BRIGHTNESS = 100;
```

Only accept finite integers inside the range. Older stored objects must receive the new defaults without losing valid existing fields.

- [ ] **Step 4: Add provider reset and brightness application**

Extend the settings context:

```ts
resetGeneralSettings: () => void;
```

Set the root variable whenever brightness changes:

```ts
document.documentElement.style.setProperty(
  "--nw-interface-brightness",
  String(generalSettings.interfaceBrightness / 100)
);
```

- [ ] **Step 5: Run focused and full tests**

Run:

```powershell
npm.cmd test -- tests/generalSettingsStorage.test.ts
npm.cmd run typecheck
npm.cmd test
```

Expected: all commands pass with no test failures.

- [ ] **Step 6: Commit**

```powershell
git add src/settings tests/generalSettingsStorage.test.ts
git commit -m "feat: persist update and brightness preferences"
```

---

### Task 2: Add the Shared Modal and Safe Reset Flow

**Files:**
- Create: `src/components/AppDialog.tsx`
- Modify: `src/settings/lastPageStorage.ts`
- Modify: `src/theme/ThemeProvider.tsx`
- Modify: `src/i18n/LanguageProvider.tsx`
- Modify: `src/density/DensityProvider.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Modify: `src/styles.css`
- Test: `tests/lastPageStorage.test.ts`
- Test: `tests/translations.test.ts`
- Create: `tests/appDialog.test.tsx`

**Interfaces:**
- Consumes: default theme/language/density constants and `resetGeneralSettings`.
- Produces:
  - `clearStoredLastPage(storage?): void`
  - `resetTheme(): void`
  - `resetLanguage(): void`
  - `resetDensity(): void`
  - `AppDialog` with `title`, `description`, `children`, `primaryAction`, `secondaryAction`, and `onClose`
  - `SettingsPage({ onResetComplete }: { onResetComplete: () => void })`

- [ ] **Step 1: Write failing reset and dialog tests**

Test last-page clearing:

```ts
writeStoredLastPage("animation", storage);
clearStoredLastPage(storage);
expect(readStoredLastPage(storage)).toBe("home");
```

Render `AppDialog` to static markup and assert:

```ts
expect(markup).toContain('role="dialog"');
expect(markup).toContain('aria-modal="true"');
expect(markup).toContain("重置所有设置");
```

Extend translation completeness assertions for reset title, body, confirm, and cancel in all five languages.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/lastPageStorage.test.ts tests/appDialog.test.tsx tests/translations.test.ts
```

Expected: FAIL for missing reset APIs, modal, and copy.

- [ ] **Step 3: Implement provider reset APIs**

Each provider resets its own state using its existing default constant. Add `clearStoredLastPage` using `removeItem`; extend the local storage interface accordingly.

- [ ] **Step 4: Implement `AppDialog`**

Requirements:

- Render into `document.body` with `createPortal`.
- Use `role="dialog"` and `aria-modal="true"`.
- Close on Esc and backdrop click.
- Stop propagation inside the panel.
- Focus the primary action after opening.
- Restore focus to the opener after closing.
- Use NYAWORKS theme tokens; no native `confirm()`.

- [ ] **Step 5: Add reset UI and coordination**

Place the row after interface density:

```tsx
<SettingRow label={labels.resetAllSettings}>
  <button className="setting-reset-button" type="button">
    {labels.resetAction}
  </button>
</SettingRow>
```

On confirmation:

1. reset general settings;
2. reset theme, language, and density;
3. clear stored last page;
4. close the dialog;
5. call `onResetComplete()` so `App` returns to `home`.

- [ ] **Step 6: Verify browser interactions**

At `520 × 960`:

- open reset dialog;
- close via Esc;
- reopen and close via cancel;
- confirm reset from a non-default theme/language/density;
- verify defaults and home navigation;
- confirm no horizontal overflow.

- [ ] **Step 7: Run full verification and commit**

```powershell
npm.cmd run verify
git diff --check
git add src tests
git commit -m "feat: add safe settings reset flow"
```

---

### Task 3: Add Theme-Relative Interface Brightness

**Files:**
- Create: `src/components/BrightnessControl.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/styles.css`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Test: `tests/settingsSelect.test.tsx`
- Test: `tests/translations.test.ts`

**Interfaces:**
- Consumes: `interfaceBrightness` and `updateGeneralSettings`.
- Produces:
  - `BrightnessControl({ value, min, max, onChange, ariaLabel })`
  - root CSS variable `--nw-interface-brightness`

- [ ] **Step 1: Write failing UI contract tests**

Render the general settings page and assert:

```ts
expect(markup).toContain('type="range"');
expect(markup).toContain('min="90"');
expect(markup).toContain('max="110"');
expect(markup).toContain('aria-label="界面亮度"');
```

Add translation assertions for the brightness label in all languages.

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npm.cmd test -- tests/settingsSelect.test.tsx tests/translations.test.ts
```

Expected: FAIL because the slider and copy are absent.

- [ ] **Step 3: Implement the control and placement**

Insert the row between current language and Home Banner. Display the percentage beside the range:

```tsx
<BrightnessControl
  value={generalSettings.interfaceBrightness}
  min={MIN_INTERFACE_BRIGHTNESS}
  max={MAX_INTERFACE_BRIGHTNESS}
  ariaLabel={labels.interfaceBrightness}
  onChange={(interfaceBrightness) =>
    updateGeneralSettings({ interfaceBrightness })
  }
/>
```

- [ ] **Step 4: Apply brightness consistently**

Define:

```css
:root {
  --nw-interface-brightness: 1;
}

#root,
.setting-select-popover,
.app-dialog-layer {
  filter: brightness(var(--nw-interface-brightness));
}
```

Keep the slider itself theme-colored using `--nw-accent`, `--nw-border-strong`, and `--nw-surface-strong`. Add WebKit and Firefox thumb/track rules without gradients.

- [ ] **Step 5: Verify all themes and bounds**

For each of the five themes, inspect `90%`, `100%`, and `110%`. Confirm text remains readable, borders remain visible, and portal dropdowns/dialogs match the panel brightness.

- [ ] **Step 6: Run full verification and commit**

```powershell
npm.cmd run verify
git diff --check
git add src tests
git commit -m "feat: add interface brightness control"
```

---

### Task 4: Add Local What's New Notifications

**Files:**
- Create: `src/updates/types.ts`
- Create: `src/updates/releaseNotes.ts`
- Create: `src/updates/releaseNotesStorage.ts`
- Create: `src/updates/UpdatesProvider.tsx`
- Create: `src/components/WhatsNewButton.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Modify: `src/styles.css`
- Create: `tests/releaseNotesStorage.test.ts`
- Modify: `tests/translations.test.ts`

**Interfaces:**
- Consumes: `PRODUCT_VERSION`, `showWhatsNew`, `AppDialog`, and language state.
- Produces:
  - `CURRENT_RELEASE_NOTES`
  - `readLastSeenVersion(storage?): string | null`
  - `writeLastSeenVersion(version, storage?): void`
  - `useUpdates()` with `hasUnreadNotes`, `openWhatsNew`, and `closeDialog`
  - `WhatsNewButton`

- [ ] **Step 1: Write failing unread-state tests**

Test:

```ts
expect(hasUnreadReleaseNotes("0.1.0-alpha.1", null)).toBe(true);
expect(hasUnreadReleaseNotes("0.1.0-alpha.1", "0.1.0-alpha.1")).toBe(false);
```

Verify malformed storage reads as unseen rather than crashing.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npm.cmd test -- tests/releaseNotesStorage.test.ts tests/translations.test.ts
```

Expected: FAIL because release-note storage and new copy are absent.

- [ ] **Step 3: Add bundled release notes**

Create one typed current-version entry with localized sections:

```ts
interface LocalizedReleaseNotes {
  version: string;
  releaseDate: string;
  sections: {
    features: readonly string[];
    improvements: readonly string[];
    fixes: readonly string[];
  };
}
```

Populate concise notes for `0.1.0-alpha.1` in all five languages.

- [ ] **Step 4: Implement provider and top-bar button**

Insert `WhatsNewButton` before `ThemeMenu`:

```tsx
<WhatsNewButton />
<ThemeMenu />
<LanguageMenu />
```

Use `BellRinging`. Keep the button always visible. Show a small accent dot only when `showWhatsNew && hasUnreadNotes`. Opening the dialog records `PRODUCT_VERSION` as seen.

- [ ] **Step 5: Build the What's New dialog**

Use `AppDialog`. Render version/date plus Features, Improvements, and Fixes sections. Empty sections are omitted. All headings and actions come from the active language bundle.

- [ ] **Step 6: Add the setting**

Place “Show What's New notifications” immediately above dangerous-action confirmation. Toggling it off hides the badge but does not remove the button or erase release-note history.

- [ ] **Step 7: Browser acceptance**

Verify:

- button order is notification, theme, language, settings;
- unread dot appears once;
- opening the dialog marks the current version read;
- the button still opens the dialog with notifications disabled;
- all five languages fit at `520 × 960` and `420 × 640`.

- [ ] **Step 8: Run full verification and commit**

```powershell
npm.cmd run verify
git diff --check
git add src tests
git commit -m "feat: add whats new notifications"
```

---

### Task 5: Add GitHub Release Update Checks

**Files:**
- Create: `src/updates/version.ts`
- Create: `src/updates/githubReleaseService.ts`
- Modify: `src/updates/types.ts`
- Modify: `src/updates/UpdatesProvider.tsx`
- Modify: `src/about/productInfo.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Modify: `src/styles.css`
- Create: `tests/version.test.ts`
- Create: `tests/githubReleaseService.test.ts`
- Modify: `tests/externalLinks.test.ts`

**Interfaces:**
- Consumes: `PRODUCT_VERSION`, `autoCheckUpdates`, `AppDialog`, and `openExternalUrl`.
- Produces:
  - `GITHUB_RELEASES_URL`
  - `normalizeVersionTag(tag: string): ParsedVersion | null`
  - `compareVersions(left: string, right: string): -1 | 0 | 1`
  - `fetchLatestRelease(fetcher?: typeof fetch): Promise<ReleaseInfo | null>`
  - update dialog state in `useUpdates()`

- [ ] **Step 1: Write failing version comparison tests**

Cover:

```ts
expect(compareVersions("0.1.0-alpha.1", "v0.1.0-alpha.2")).toBe(-1);
expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBe(1);
expect(compareVersions("invalid", "1.0.0")).toBe(0);
```

The invalid case must be non-updating rather than throwing.

- [ ] **Step 2: Run version tests and verify RED**

```powershell
npm.cmd test -- tests/version.test.ts
```

Expected: FAIL because comparison functions are absent.

- [ ] **Step 3: Implement version parsing and comparison**

Accept an optional leading `v`, three numeric core segments, and dot-separated prerelease identifiers. Stable releases sort above prereleases with the same core version.

- [ ] **Step 4: Write failing GitHub response tests**

Use injected fake fetch functions and literal payloads. Cover:

- valid published release;
- draft release;
- missing `tag_name`;
- unsafe or missing `html_url`;
- `404` and `403`;
- rejected network request;
- latest version equal to current.

- [ ] **Step 5: Implement the release service**

Request:

```ts
fetch("https://api.github.com/repos/kuroii07/NYAWORKS/releases/latest", {
  headers: { Accept: "application/vnd.github+json" }
});
```

Validate `tag_name`, `name`, `body`, `html_url`, `draft`, and `prerelease`. Return `null` for invalid/unavailable results. Never throw into the UI.

- [ ] **Step 6: Extend `UpdatesProvider`**

On the provider's first client mount:

1. read `autoCheckUpdates`;
2. return immediately when false;
3. fetch once;
4. compare the release tag with `PRODUCT_VERSION`;
5. open the update dialog only when remote is newer.

Do not persist “Not now”. Do not repeat the request during the same mounted session.

- [ ] **Step 7: Implement the update dialog and setting**

Place “Auto-check updates” below “Remember last page”. The dialog shows remote title, version, sanitized plain-text summary, and two actions:

- primary: open `release.htmlUrl`;
- secondary: close for this session.

Never inject GitHub Markdown as HTML.

- [ ] **Step 8: Browser and failure acceptance**

Use injected development fixtures to verify:

- newer version opens the dialog;
- “Not now” closes it;
- disabled setting makes zero requests;
- request rejection leaves the interface usable;
- “Update” opens only an HTTPS GitHub Release URL.

- [ ] **Step 9: Run full verification and commit**

```powershell
npm.cmd run verify
git diff --check
git add src tests
git commit -m "feat: add GitHub release update checks"
```

---

### Task 6: Final Responsive, Localization, and Documentation Pass

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/translations.test.ts`
- Modify: `README.md`
- Modify: `planning/02-roadmap.md`
- Create: `docs/screenshots/settings-general-updates.png`
- Create: `docs/screenshots/whats-new-dialog.png`
- Create: `docs/screenshots/update-available-dialog.png`

**Interfaces:**
- Consumes: all completed components and services.
- Produces: final documented and visually reviewed feature increment.

- [ ] **Step 1: Complete translation coverage**

For each language, assert non-empty strings for:

- automatic update setting;
- What's New setting and top-bar tooltip;
- brightness;
- reset button and confirmation;
- update dialog;
- What's New sections and actions.

- [ ] **Step 2: Verify density and language layouts**

Check large, medium, and small density at `520 × 960`; check the minimum `420 × 640` viewport. Repeat with English, Japanese, and Korean where text expansion is most likely.

- [ ] **Step 3: Verify all themes and brightness bounds**

For all five themes:

- inspect `90%`, `100%`, and `110%`;
- open `SettingSelect`;
- open the reset dialog;
- open the What's New dialog;
- confirm borders, text, and overlays remain legible.

- [ ] **Step 4: Capture final screenshots**

Save:

```text
docs/screenshots/settings-general-updates.png
docs/screenshots/whats-new-dialog.png
docs/screenshots/update-available-dialog.png
```

- [ ] **Step 5: Update documentation**

Document:

- preference defaults;
- GitHub network dependency;
- “Not now” reminder behavior;
- first-stage external-download flow;
- automatic installation as a future item;
- browser verification versus AE-host verification.

- [ ] **Step 6: Run final verification**

```powershell
npm.cmd run verify
git diff --check
git status --short
```

Expected: all tests pass, production build succeeds, smoke check passes, and only intentional files remain changed.

- [ ] **Step 7: Commit the integration**

```powershell
git add README.md planning/02-roadmap.md docs/screenshots src tests
git commit -m "docs: finalize settings update workflow"
```

- [ ] **Step 8: Review before push**

Review the complete branch diff and screenshots. Do not push until the user accepts the browser result. After acceptance:

```powershell
git push -u origin HEAD
```

