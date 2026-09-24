# NYAWORKS AI Settings System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI settings placeholder with a complete, theme-aware connection management page that supports built-in providers, multiple custom OpenAI-compatible connections, model discovery/manual entry, explicit saves, global defaults, per-feature overrides, and honest secret-storage behavior.

**Architecture:** Keep AI settings as an isolated feature under `src/aiSettings/` with versioned non-secret storage, an in-memory secret store for the current browser/CEP session, provider adapters for connection testing/model discovery, and a focused `AiSettingsPanel` page. `SettingsProvider` owns persisted non-secret settings; page-local drafts prevent unsaved edits from leaking into stored state. The UI reuses NYAWORKS dialogs, menus, selects, theme tokens, motion preferences, and five-language translation system.

**Tech Stack:** React 18, TypeScript 5.6, Vite 8, Vitest 5, Phosphor Icons, CSS, CEP/Chromium 74 target.

**Spec:** `docs/superpowers/specs/2026-09-24-ai-settings-system-design.md`

## Global Constraints

- Preserve the confirmed five themes, language switch behavior, General settings, Home settings, About settings, and existing navigation.
- The default panel width must not produce horizontal scrolling.
- Built-in providers are fixed; custom OpenAI-compatible connections may be created, renamed, copied, disabled, and deleted.
- The model field must accept free text and also offer discovered models after an explicit refresh.
- Connection testing and saving are independent actions.
- Unsaved drafts must not be silently discarded when switching connection or settings tab.
- API keys must never be written to `localStorage`, exported presets, logs, diagnostics, URLs, or test snapshots.
- Browser preview must not claim OS-secure persistence; it uses session-only in-memory secrets.
- All new user-facing copy must exist in Simplified Chinese, Traditional Chinese, English, Japanese, and Korean.
- Browser validation and real After Effects CEP validation must be reported separately.

## Review Focus

- A stored connection whose `apiKeyRef` no longer exists must become “needs key” without deleting its base URL or model.
- A failed or unsupported model-list request must preserve the manually entered model.
- Switching provider, custom connection, or settings tab with a dirty draft must require save, discard, or cancel.
- Deleting or disabling a routed connection must fall back safely to the global default; deleting the global default must not leave a dangling ID.
- Long translated labels and long custom connection/model names must not create horizontal overflow at the default and minimum panel widths.

---

### Task 1: AI settings domain, catalog, and normalization

**Files:**
- Create: `src/aiSettings/types.ts`
- Create: `src/aiSettings/providerCatalog.ts`
- Create: `src/aiSettings/aiSettingsStorage.ts`
- Test: `tests/aiSettingsStorage.test.ts`
- Modify: `src/settings/types.ts`

**Interfaces:**
- Produces: `AiSettings`, `AiConnection`, `AiConnectionDraft`, `AiModelTarget`, `AiFeatureRouting`, `AiGenerationPreferences`.
- Produces: `AI_PROVIDER_CATALOG`, `BUILT_IN_AI_CONNECTIONS`, `DEFAULT_AI_SETTINGS`.
- Produces: `normalizeAiSettings(value)`, `readStoredAiSettings(storage?)`, `writeStoredAiSettings(settings, storage?)`.

- [ ] **Step 1: Write failing storage and normalization tests**

Cover:

```ts
it("creates all eight built-in providers without storing secrets", () => {
  const settings = readStoredAiSettings();
  expect(settings.connections.filter((item) => item.kind === "built-in"))
    .toHaveLength(8);
  expect(JSON.stringify(settings)).not.toContain("apiKey");
});

it("removes dangling routes and preserves valid manual models", () => {
  const normalized = normalizeAiSettings({
    schemaVersion: 1,
    connections: [
      {
        id: "custom:one",
        kind: "custom",
        providerId: "openai-compatible",
        displayName: " Studio Relay ",
        enabled: true,
        baseUrl: "https://example.com/v1/",
        apiKeyRef: "secret:one",
        selectedModel: "custom-model",
        discoveredModels: [],
        modelsFetchedAt: null,
        verificationStatus: "connected",
        lastTestedAt: null,
        createdAt: "2026-09-24T00:00:00.000Z",
        updatedAt: "2026-09-24T00:00:00.000Z"
      }
    ],
    globalDefault: { connectionId: "missing", model: "missing" },
    featureRouting: {
      chat: "inherit",
      expression: { connectionId: "missing", model: "missing" },
      script: { connectionId: "custom:one", model: "custom-model" }
    }
  });

  expect(normalized.connections[0].displayName).toBe("Studio Relay");
  expect(normalized.connections[0].baseUrl).toBe("https://example.com/v1");
  expect(normalized.globalDefault).toBeNull();
  expect(normalized.featureRouting.expression).toBe("inherit");
  expect(normalized.featureRouting.script).toEqual({
    connectionId: "custom:one",
    model: "custom-model"
  });
});
```

Also test corrupt JSON fallback, duplicate custom IDs, invalid URLs, invalid discovered model entries, and round-trip persistence.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```powershell
npm.cmd test -- tests/aiSettingsStorage.test.ts
```

Expected: failure because the AI settings modules do not exist.

- [ ] **Step 3: Implement domain types, provider catalog, and safe normalization**

Use these core definitions:

```ts
export type BuiltInAiProviderId =
  | "openai"
  | "claude"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "doubao"
  | "kimi"
  | "zhipu";

export type AiVerificationStatus =
  | "unconfigured"
  | "needs-key"
  | "unverified"
  | "connected"
  | "failed";

export interface AiConnection {
  id: string;
  kind: "built-in" | "custom";
  providerId: BuiltInAiProviderId | "openai-compatible";
  displayName: string;
  enabled: boolean;
  baseUrl: string;
  apiKeyRef: string | null;
  selectedModel: string;
  discoveredModels: string[];
  modelsFetchedAt: string | null;
  verificationStatus: AiVerificationStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiSettings {
  schemaVersion: 1;
  connections: AiConnection[];
  globalDefault: AiModelTarget | null;
  featureRouting: AiFeatureRouting;
  generation: AiGenerationPreferences;
  saveConversationHistory: boolean;
  includeAeContext: boolean;
}
```

Store only non-secret values under `nyaworks.settings.ai.v1`. Normalize URLs by trimming whitespace and a trailing slash. Always restore missing built-in providers while preserving valid user configuration.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm.cmd test -- tests/aiSettingsStorage.test.ts
```

Expected: all AI settings storage tests pass.

- [ ] **Step 5: Commit the domain layer**

```powershell
git add src/aiSettings src/settings/types.ts tests/aiSettingsStorage.test.ts
git commit -m "feat: add AI settings domain"
```

### Task 2: Session-safe secret store and provider adapters

**Files:**
- Create: `src/aiSettings/secretStore.ts`
- Create: `src/aiSettings/providerAdapters.ts`
- Test: `tests/aiSecretStore.test.ts`
- Test: `tests/aiProviderAdapters.test.ts`

**Interfaces:**
- Consumes: `AiConnectionDraft` and provider catalog definitions from Task 1.
- Produces: `AiSecretStore`, `sessionAiSecretStore`.
- Produces: `testAiConnection(draft, secret, fetcher?, signal?)`.
- Produces: `listAiModels(draft, secret, fetcher?, signal?)`.
- Produces normalized result unions with safe error codes and no raw secret content.

- [ ] **Step 1: Write failing secret store tests**

```ts
it("stores a key only in the supplied session store", async () => {
  const store = createMemoryAiSecretStore();
  const reference = await store.save("custom:one", "sk-secret");
  expect(await store.has(reference)).toBe(true);
  expect(await store.readForRequest(reference)).toBe("sk-secret");
  await store.remove(reference);
  expect(await store.has(reference)).toBe(false);
});

it("never exposes the secret through JSON serialization", async () => {
  const store = createMemoryAiSecretStore();
  await store.save("custom:one", "sk-secret");
  expect(JSON.stringify(store)).not.toContain("sk-secret");
});
```

- [ ] **Step 2: Write failing adapter tests**

Cover:

- OpenAI-compatible model response `{ data: [{ id }] }`.
- Gemini-style model response normalization.
- unsupported model-list endpoint returns `unsupported`.
- HTTP 401 becomes `invalid-key`.
- abort/timeout becomes `timeout`.
- invalid JSON becomes `invalid-response`.
- request URL never contains the secret.
- manually selected model is outside adapter result and remains untouched by the adapter.

- [ ] **Step 3: Run tests and confirm failure**

```powershell
npm.cmd test -- tests/aiSecretStore.test.ts tests/aiProviderAdapters.test.ts
```

- [ ] **Step 4: Implement the in-memory secret store**

Expose:

```ts
export interface AiSecretStore {
  readonly persistence: "session";
  save(connectionId: string, secret: string): Promise<string>;
  has(reference: string): Promise<boolean>;
  readForRequest(reference: string): Promise<string>;
  remove(reference: string): Promise<void>;
  clear(): Promise<void>;
}
```

Keep the backing map module-private. Generate opaque references from connection IDs plus random IDs. Do not expose enumeration or serialization methods.

- [ ] **Step 5: Implement provider request normalization**

Use an adapter registry keyed by `providerId`. Every request:

- receives the secret separately from the serializable draft;
- uses `Authorization` or provider-specific headers;
- accepts an injected `fetcher` for tests;
- uses an abort signal;
- returns short safe error codes;
- discards raw response bodies after parsing.

For providers whose browser model-list endpoint cannot be guaranteed, return an explicit `unsupported` result so the UI keeps manual entry usable.

- [ ] **Step 6: Run focused tests**

```powershell
npm.cmd test -- tests/aiSecretStore.test.ts tests/aiProviderAdapters.test.ts
```

- [ ] **Step 7: Commit the service layer**

```powershell
git add src/aiSettings/secretStore.ts src/aiSettings/providerAdapters.ts tests/aiSecretStore.test.ts tests/aiProviderAdapters.test.ts
git commit -m "feat: add AI connection services"
```

### Task 3: Persist AI settings in the application provider

**Files:**
- Modify: `src/settings/SettingsProvider.tsx`
- Modify: `src/settings/types.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Test: `tests/aiSettingsProvider.test.tsx`

**Interfaces:**
- Consumes: `readStoredAiSettings`, `writeStoredAiSettings`, `DEFAULT_AI_SETTINGS`.
- Produces from `useSettings()`: `aiSettings`, `replaceAiSettings`, `updateAiSettings`, `resetAiSettings`.
- Produces from `SettingsPage`: optional `onRequestSettingsTabChange` guard path owned by the active AI panel.

- [ ] **Step 1: Write failing provider tests**

Verify:

- initial defaults are available;
- updating AI settings writes only non-secret JSON;
- resetting returns built-in provider defaults;
- General “reset all” does not clear AI settings or API keys, matching existing product copy.

- [ ] **Step 2: Run the focused test**

```powershell
npm.cmd test -- tests/aiSettingsProvider.test.tsx
```

- [ ] **Step 3: Add AI settings state and persistence**

Add `aiSettings` beside General and Home settings, but do not use partial shallow patches for nested connection edits. Expose:

```ts
replaceAiSettings: (settings: AiSettings) => void;
updateAiSettings: (updater: (current: AiSettings) => AiSettings) => void;
resetAiSettings: () => void;
```

Persist through `aiSettingsStorage.ts`. Never pass a secret string into `SettingsProvider`.

- [ ] **Step 4: Run focused and existing provider tests**

```powershell
npm.cmd test -- tests/aiSettingsProvider.test.tsx tests/generalSettingsStorage.test.ts tests/homeSettingsStorage.test.ts
```

- [ ] **Step 5: Commit provider integration**

```powershell
git add src/settings src/pages/SettingsPage.tsx tests/aiSettingsProvider.test.tsx
git commit -m "feat: persist AI connection settings"
```

### Task 4: Reusable model combobox and connection dialogs

**Files:**
- Create: `src/components/ModelComboBox.tsx`
- Create: `src/pages/AiConnectionDialog.tsx`
- Test: `tests/modelComboBox.test.tsx`
- Test: `tests/aiConnectionDialog.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `AppDialog`, project theme tokens, and `AiConnectionDraft`.
- Produces: `ModelComboBox` with free input, discovered option list, refresh button, loading/error state.
- Produces: `AiConnectionDialog` for create/rename with inline validation.

- [ ] **Step 1: Write failing component tests**

Verify static markup and callback behavior for:

- free-text model input;
- refresh button with accessible label;
- model list options;
- selected manual model retained when it is absent from discovered models;
- custom connection name validation;
- duplicate-name error;
- no native `<select>` or browser prompt.

- [ ] **Step 2: Run component tests and confirm failure**

```powershell
npm.cmd test -- tests/modelComboBox.test.tsx tests/aiConnectionDialog.test.tsx
```

- [ ] **Step 3: Implement the model combobox**

The control contains:

```tsx
<input
  value={value}
  onChange={(event) => onChange(event.target.value)}
  role="combobox"
  aria-expanded={open}
  aria-controls={listboxId}
/>
<button type="button" aria-label={refreshLabel} onClick={onRefresh}>
  <ArrowsClockwise />
</button>
```

Render discovered options in a project-styled fixed popover aligned to the input width. Support Escape, ArrowUp, ArrowDown, Enter, outside click, and viewport repositioning.

- [ ] **Step 4: Implement the custom connection dialog**

Reuse `AppDialog`, custom input controls, and the model combobox. Keep connection test and create/save as separate actions. Do not use `prompt()` or native `<select>`.

- [ ] **Step 5: Add component styles and responsive rules**

Use current control heights, border tokens, radius tokens, tooltip patterns, and motion variables. The listbox must not exceed its trigger width or viewport.

- [ ] **Step 6: Run focused tests**

```powershell
npm.cmd test -- tests/modelComboBox.test.tsx tests/aiConnectionDialog.test.tsx
```

- [ ] **Step 7: Commit reusable controls**

```powershell
git add src/components/ModelComboBox.tsx src/pages/AiConnectionDialog.tsx src/styles.css tests/modelComboBox.test.tsx tests/aiConnectionDialog.test.tsx
git commit -m "feat: add AI configuration controls"
```

### Task 5: Build the AI settings panel and draft state machine

**Files:**
- Create: `src/pages/AiSettingsPanel.tsx`
- Create: `src/aiSettings/connectionOperations.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/styles.css`
- Test: `tests/aiConnectionOperations.test.ts`
- Test: `tests/aiSettingsPanel.test.tsx`

**Interfaces:**
- Consumes: `useSettings().aiSettings`, secret store, provider adapters, `ModelComboBox`, dialogs, menus, and translated copy.
- Produces: `AiSettingsPanel`.
- Produces pure operations: `createCustomConnection`, `renameConnection`, `duplicateConnectionWithoutSecret`, `deleteConnection`, `toggleConnection`, `setGlobalDefault`, `repairFeatureRouting`.

- [ ] **Step 1: Write failing pure-operation tests**

Cover:

- custom connection ID/name uniqueness;
- duplication does not copy `apiKeyRef`;
- deleting a routed connection repairs all routes;
- deleting the global default selects no dangling connection;
- disabling a routed connection falls back to inherit;
- built-in connections cannot be deleted or renamed.

- [ ] **Step 2: Write failing panel markup tests**

The AI tab must render:

- current default summary;
- all eight built-in platform buttons;
- custom connection selector plus add and menu buttons;
- one shared configuration form;
- API key reveal/replace/clear affordances;
- model combobox with refresh;
- test and save buttons;
- feature routing;
- generation preferences;
- privacy controls;
- no AI placeholder copy;
- no native `<select>`.

- [ ] **Step 3: Run focused tests and confirm failure**

```powershell
npm.cmd test -- tests/aiConnectionOperations.test.ts tests/aiSettingsPanel.test.tsx
```

- [ ] **Step 4: Implement pure connection operations**

Keep all mutations immutable and normalize after changes. Reject destructive operations on built-in providers at the operation boundary, not only in the UI.

- [ ] **Step 5: Implement the panel draft model**

Maintain:

```ts
interface AiConnectionEditorState {
  selectedConnectionId: string;
  draft: AiConnectionDraft;
  draftSecret: string;
  dirty: boolean;
  requestState: "idle" | "testing" | "loading-models" | "saving";
  feedback: AiEditorFeedback | null;
}
```

Persist only when `Save configuration` succeeds. Connection test and model refresh read from the draft and current secret field. A saved masked key is represented by `apiKeyRef`, never by copying its real value into the draft.

- [ ] **Step 6: Implement provider grid and custom connection management**

- Eight compact built-in buttons.
- Selected/default/status markers.
- Custom selector.
- New, rename, duplicate, enable/disable, set-default, and delete actions.
- NYAWORKS dialogs and compact menus.
- Unsaved changes guard before selection changes.

- [ ] **Step 7: Implement configuration, routing, generation, and privacy sections**

- Shared connection form.
- Manual/discovered model control.
- Explicit test/save actions.
- Global default selector.
- Chat/expression/script selectors with `inherit`.
- Creativity and output limits.
- Streaming, timeout, retry.
- Conversation history and AE-context switches.
- Clear-history and clear-all-AI-data confirmations.

- [ ] **Step 8: Add asymmetric responsive layout styles**

Implement:

- full-width default summary;
- compact four-column provider grid with safe two-column fallback;
- shared form;
- asymmetric two-column routing/preferences region;
- compact full-width privacy band;
- density-specific sizing for large/medium/small;
- long-name `min-width: 0`, clipping only where controls require it, and full value in Tooltip.

- [ ] **Step 9: Run panel tests**

```powershell
npm.cmd test -- tests/aiConnectionOperations.test.ts tests/aiSettingsPanel.test.tsx
```

- [ ] **Step 10: Commit the panel**

```powershell
git add src/pages/AiSettingsPanel.tsx src/aiSettings/connectionOperations.ts src/pages/SettingsPage.tsx src/styles.css tests/aiConnectionOperations.test.ts tests/aiSettingsPanel.test.tsx
git commit -m "feat: build AI settings panel"
```

### Task 6: Add five-language AI settings copy

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Test: `tests/translations.test.ts`
- Test: `tests/aiSettingsTranslations.test.ts`

**Interfaces:**
- Produces: `copy.settings.ai` with identical typed keys in all five languages.
- Consumed by: `AiSettingsPanel`, `AiConnectionDialog`, model and status controls.

- [ ] **Step 1: Add failing translation coverage tests**

Verify:

- every language contains the full `settings.ai` key tree;
- no translation value is empty;
- provider brand names and model IDs remain unchanged;
- long English action labels stay under the agreed short-copy limits;
- old AI “coming soon” copy is absent when rendering the AI tab.

- [ ] **Step 2: Run translation tests and confirm failure**

```powershell
npm.cmd test -- tests/translations.test.ts tests/aiSettingsTranslations.test.ts
```

- [ ] **Step 3: Add typed copy for all languages**

Include labels for sections, status states, form fields, model refresh states, save/test actions, unsaved dialog, custom connection actions, generation preferences, privacy, validation, and safe normalized errors.

- [ ] **Step 4: Run translation and panel tests**

```powershell
npm.cmd test -- tests/translations.test.ts tests/aiSettingsTranslations.test.ts tests/aiSettingsPanel.test.tsx
```

- [ ] **Step 5: Commit localization**

```powershell
git add src/i18n tests/translations.test.ts tests/aiSettingsTranslations.test.ts
git commit -m "feat: localize AI settings"
```

### Task 7: Unsaved tab navigation protection and integration

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/AiSettingsPanel.tsx`
- Modify: `src/components/AppDialog.tsx` only if a third action is required
- Test: `tests/aiSettingsNavigation.test.tsx`
- Test: `tests/appDialog.test.tsx`

**Interfaces:**
- Consumes: AI panel dirty state.
- Produces: guarded settings-tab change with save/discard/cancel resolution.

- [ ] **Step 1: Write failing navigation guard tests**

Verify:

- clean AI state changes tab immediately;
- dirty state opens the project dialog;
- save continues only after persistence succeeds;
- discard continues without persistence;
- cancel leaves AI selected and keeps draft;
- Escape behaves as cancel.

- [ ] **Step 2: Run focused tests**

```powershell
npm.cmd test -- tests/aiSettingsNavigation.test.tsx tests/appDialog.test.tsx
```

- [ ] **Step 3: Implement guarded tab navigation**

Keep requested tab in pending state. Let `AiSettingsPanel` resolve:

```ts
type UnsavedResolution = "save" | "discard" | "cancel";
```

Use a project-styled three-action dialog. If extending `AppDialog`, retain compatibility with existing two-action callers.

- [ ] **Step 4: Run focused tests**

```powershell
npm.cmd test -- tests/aiSettingsNavigation.test.tsx tests/appDialog.test.tsx
```

- [ ] **Step 5: Commit navigation protection**

```powershell
git add src/pages src/components/AppDialog.tsx tests/aiSettingsNavigation.test.tsx tests/appDialog.test.tsx
git commit -m "feat: protect unsaved AI settings"
```

### Task 8: Browser fixtures, visual validation, and documentation

**Files:**
- Modify: `src/aiSettings/providerAdapters.ts`
- Create: `src/aiSettings/developmentFixtures.ts`
- Modify: `README.md`
- Create: `docs/screenshots/settings-ai.png`
- Test: `tests/aiDevelopmentFixtures.test.ts`
- Test: `tests/aiSettingsStyles.test.js`

**Interfaces:**
- Produces development-only deterministic connection/model responses selected through URL fixtures.
- Does not expose or store real API keys.

- [ ] **Step 1: Add failing fixture and CSS invariant tests**

Fixtures:

- `?aiFixture=connected`
- `?aiFixture=models`
- `?aiFixture=invalid-key`
- `?aiFixture=timeout`

CSS checks:

- four-column provider grid at normal width;
- two-column fallback;
- no hardcoded light-mode surfaces;
- all controls use existing theme variables;
- custom connection and model popovers are width-bound;
- density selectors exist for medium and small.

- [ ] **Step 2: Run focused tests**

```powershell
npm.cmd test -- tests/aiDevelopmentFixtures.test.ts tests/aiSettingsStyles.test.js
```

- [ ] **Step 3: Implement deterministic development fixtures**

Only activate fixtures when the query parameter matches an allowlist. Ignore arbitrary values. Never accept a secret from the query string.

- [ ] **Step 4: Run full automated verification**

```powershell
npm.cmd run verify
```

Expected:

- TypeScript succeeds.
- All Vitest tests pass.
- Vite production build succeeds.
- `dist` smoke check succeeds.

- [ ] **Step 5: Inspect the live browser page**

Validate at:

- default panel size;
- minimum supported width;
- medium and small density;
- all five themes;
- all five languages;
- long custom connection and model names;
- open provider/model/custom connection menus;
- connected, unconfigured, dirty, failed, and loading states.

Capture `docs/screenshots/settings-ai.png` only after the default 极夜青 Chinese view is visually accepted locally.

- [ ] **Step 6: Update README honestly**

Document:

- implemented AI settings management;
- built-in and custom providers;
- manual/model discovery behavior;
- global default and per-feature override;
- browser preview uses session-only API keys;
- real AE CEP secure persistence and live provider networking require separate host acceptance.

- [ ] **Step 7: Run final verification and inspect Git state**

```powershell
npm.cmd run verify
git diff --check
git status --short
```

Do not add the existing untracked `output/` directory.

- [ ] **Step 8: Commit final validation artifacts**

```powershell
git add src/aiSettings/developmentFixtures.ts src/aiSettings/providerAdapters.ts README.md docs/screenshots/settings-ai.png tests/aiDevelopmentFixtures.test.ts tests/aiSettingsStyles.test.js
git commit -m "docs: finalize AI settings preview"
```
