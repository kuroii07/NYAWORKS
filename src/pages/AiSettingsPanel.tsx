import type { ComponentType } from "react";
import {
  ArrowsClockwise,
  Brain,
  ChatCircleDots,
  Cloud,
  Code,
  Copy,
  Cube,
  Database,
  DotsThree,
  Eye,
  EyeSlash,
  FloppyDisk,
  Function as FunctionIcon,
  Hexagon,
  Key,
  Lightning,
  LinkSimple,
  MoonStars,
  PencilSimple,
  PlugsConnected,
  Plus,
  Power,
  Robot,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  Star,
  Trash,
  type IconProps
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import {
  createCustomConnection,
  deleteConnection,
  duplicateConnectionWithoutSecret,
  renameConnection,
  setGlobalDefault,
  toggleConnection
} from "../aiSettings/connectionOperations";
import {
  listAiModels,
  testAiConnection,
  type AiRequestErrorCode
} from "../aiSettings/providerAdapters";
import { AI_PROVIDER_CATALOG } from "../aiSettings/providerCatalog";
import { sessionAiSecretStore } from "../aiSettings/secretStore";
import type {
  AiConnection,
  AiConnectionDraft,
  AiFeatureRouting,
  AiModelTarget
} from "../aiSettings/types";
import { AppDialog } from "../components/AppDialog";
import {
  CompactActionMenu,
  type CompactActionMenuItem
} from "../components/CompactActionMenu";
import { ModelComboBox } from "../components/ModelComboBox";
import {
  SettingSelect,
  type SettingSelectOption
} from "../components/SettingSelect";
import { useLanguage } from "../i18n/LanguageProvider";
import { useSettings } from "../settings/SettingsProvider";
import {
  AiConnectionDialog,
  type AiConnectionDialogRequestState
} from "./AiConnectionDialog";

type SettingIcon = ComponentType<IconProps>;
type RequestState = AiConnectionDialogRequestState;
type FeedbackTone = "success" | "warning" | "danger" | "neutral";

interface EditorFeedback {
  tone: FeedbackTone;
  message: string;
}

interface PendingSelection {
  connectionId: string;
}

interface CustomDialogState {
  mode: "create" | "edit";
  draft: AiConnectionDraft;
  secret: string;
  requestState: RequestState;
  feedback: string | null;
}

const NONE_VALUE = "__none";
const INHERIT_VALUE = "__inherit";

const PROVIDER_ICONS: Record<string, SettingIcon> = {
  openai: Robot,
  claude: Brain,
  gemini: Sparkle,
  deepseek: Lightning,
  qwen: Cloud,
  doubao: Cube,
  kimi: MoonStars,
  zhipu: Hexagon,
  "openai-compatible": PlugsConnected
};

function toDraft(connection: AiConnection): AiConnectionDraft {
  return {
    id: connection.id,
    kind: connection.kind,
    providerId: connection.providerId,
    displayName: connection.displayName,
    enabled: connection.enabled,
    baseUrl: connection.baseUrl,
    apiKeyRef: connection.apiKeyRef,
    selectedModel: connection.selectedModel,
    discoveredModels: [...connection.discoveredModels],
    modelsFetchedAt: connection.modelsFetchedAt
  };
}

function createId(): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `custom:${randomPart}`;
}

function createEmptyCustomDraft(): AiConnectionDraft {
  return {
    id: createId(),
    kind: "custom",
    providerId: "openai-compatible",
    displayName: "",
    enabled: true,
    baseUrl: "",
    apiKeyRef: null,
    selectedModel: "",
    discoveredModels: [],
    modelsFetchedAt: null
  };
}

function targetToValue(target: AiModelTarget | null): string {
  return target ? `${target.connectionId}::${target.model}` : NONE_VALUE;
}

function routeToValue(
  route: AiFeatureRouting[keyof AiFeatureRouting]
): string {
  return route === "inherit" ? INHERIT_VALUE : targetToValue(route);
}

function valueToTarget(value: string): AiModelTarget | null {
  if (value === NONE_VALUE || value === INHERIT_VALUE) {
    return null;
  }

  const separator = value.indexOf("::");

  if (separator < 1) {
    return null;
  }

  return {
    connectionId: value.slice(0, separator),
    model: value.slice(separator + 2)
  };
}

function sameDraft(draft: AiConnectionDraft, connection: AiConnection): boolean {
  return (
    draft.displayName === connection.displayName &&
    draft.enabled === connection.enabled &&
    draft.baseUrl === connection.baseUrl &&
    draft.apiKeyRef === connection.apiKeyRef &&
    draft.selectedModel === connection.selectedModel &&
    JSON.stringify(draft.discoveredModels) ===
      JSON.stringify(connection.discoveredModels) &&
    draft.modelsFetchedAt === connection.modelsFetchedAt
  );
}

function AiSection({
  icon: Icon,
  title,
  action,
  children,
  className = ""
}: {
  icon: SettingIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`settings-section ai-settings-section ${className}`}>
      <h2>
        <Icon aria-hidden="true" weight="regular" />
        <span>{title}</span>
        {action}
      </h2>
      <div className="settings-section__rows">{children}</div>
    </section>
  );
}

function AiSwitch({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="setting-switch"
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function AiSettingsPanel({
  onDirtyStateChange
}: {
  onDirtyStateChange?: (dirty: boolean) => void;
}) {
  const { copy } = useLanguage();
  const AI_COPY = copy.settings.ai;
  const STATUS_LABELS: Record<
    AiConnection["verificationStatus"],
    string
  > = {
    unconfigured: AI_COPY.unconfigured,
    "needs-key": AI_COPY.needsKey,
    unverified: AI_COPY.unverified,
    connected: AI_COPY.connected,
    failed: AI_COPY.failed
  };
  const {
    aiSettings,
    updateAiSettings,
    resetAiSettings
  } = useSettings();
  const initialConnection =
    aiSettings.connections.find((connection) => connection.kind === "built-in") ??
    aiSettings.connections[0];
  const [selectedConnectionId, setSelectedConnectionId] = useState(
    initialConnection?.id ?? ""
  );
  const selectedConnection =
    aiSettings.connections.find(
      (connection) => connection.id === selectedConnectionId
    ) ?? aiSettings.connections[0];
  const [draft, setDraft] = useState<AiConnectionDraft>(() =>
    selectedConnection ? toDraft(selectedConnection) : createEmptyCustomDraft()
  );
  const [draftSecret, setDraftSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
  const [testedSuccessfully, setTestedSuccessfully] = useState(false);
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [customDialog, setCustomDialog] =
    useState<CustomDialogState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AiConnection | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  const dirty = selectedConnection
    ? Boolean(draftSecret) || !sameDraft(draft, selectedConnection)
    : Boolean(draftSecret);

  useEffect(() => {
    onDirtyStateChange?.(dirty);
  }, [dirty, onDirtyStateChange]);

  useEffect(() => {
    if (!selectedConnection) {
      return;
    }

    if (selectedConnection.id !== draft.id && !dirty) {
      setDraft(toDraft(selectedConnection));
      setDraftSecret("");
      setFeedback(null);
      setTestedSuccessfully(false);
    }
  }, [dirty, draft.id, selectedConnection]);

  const customConnections = aiSettings.connections.filter(
    (connection) => connection.kind === "custom"
  );
  const activeCustomId =
    selectedConnection?.kind === "custom"
      ? selectedConnection.id
      : customConnections[0]?.id ?? NONE_VALUE;
  const customOptions: SettingSelectOption<string>[] =
    customConnections.length > 0
      ? customConnections.map((connection) => ({
          value: connection.id,
          label: connection.displayName
        }))
      : [{ value: NONE_VALUE, label: AI_COPY.noCustomConnections }];

  const modelTargets = aiSettings.connections.filter(
    (connection) => connection.enabled && connection.selectedModel.trim()
  );
  const globalOptions: SettingSelectOption<string>[] = [
    { value: NONE_VALUE, label: AI_COPY.noDefault },
    ...modelTargets.map((connection) => ({
      value: targetToValue({
        connectionId: connection.id,
        model: connection.selectedModel
      }),
      label: `${connection.displayName} · ${connection.selectedModel}`
    }))
  ];
  const routeOptions: SettingSelectOption<string>[] = [
    { value: INHERIT_VALUE, label: AI_COPY.inherit },
    ...globalOptions.slice(1)
  ];
  const currentDefaultConnection = aiSettings.globalDefault
    ? aiSettings.connections.find(
        (connection) => connection.id === aiSettings.globalDefault?.connectionId
      )
    : null;

  function resetEditor(connection: AiConnection) {
    setSelectedConnectionId(connection.id);
    setDraft(toDraft(connection));
    setDraftSecret("");
    setShowSecret(false);
    setFeedback(null);
    setTestedSuccessfully(false);
  }

  function requestConnectionSelection(connectionId: string) {
    if (!connectionId || connectionId === NONE_VALUE) {
      return;
    }

    if (dirty) {
      setPendingSelection({ connectionId });
      return;
    }

    const connection = aiSettings.connections.find(
      (candidate) => candidate.id === connectionId
    );

    if (connection) {
      resetEditor(connection);
    }
  }

  async function resolveSecret(
    targetDraft: AiConnectionDraft,
    inputSecret: string
  ): Promise<string | null> {
    if (inputSecret.trim()) {
      return inputSecret.trim();
    }

    if (
      targetDraft.apiKeyRef &&
      (await sessionAiSecretStore.has(targetDraft.apiKeyRef))
    ) {
      return sessionAiSecretStore.readForRequest(targetDraft.apiKeyRef);
    }

    return null;
  }

  function errorMessage(code: AiRequestErrorCode): string {
    return AI_COPY.requestErrors[code];
  }

  async function refreshDraftModels(
    targetDraft: AiConnectionDraft,
    secretInput: string,
    update: (patch: Partial<AiConnectionDraft>) => void,
    setDialogFeedback?: (message: string | null) => void,
    setDialogRequest?: (state: RequestState) => void
  ) {
    const secret = await resolveSecret(targetDraft, secretInput);

    if (!secret) {
      const message = AI_COPY.missingKey;
      setDialogFeedback?.(message);
      if (!setDialogFeedback) {
        setFeedback({ tone: "warning", message });
      }
      return;
    }

    setDialogRequest?.("loading-models");
    if (!setDialogRequest) {
      setRequestState("loading-models");
    }
    const result = await listAiModels(targetDraft, secret);

    if (result.ok) {
      update({
        discoveredModels: result.models,
        modelsFetchedAt: new Date().toISOString()
      });
      const message = AI_COPY.modelsLoaded(result.models.length);
      setDialogFeedback?.(message);
      if (!setDialogFeedback) {
        setFeedback({ tone: "success", message });
      }
    } else {
      const message = errorMessage(result.error);
      setDialogFeedback?.(message);
      if (!setDialogFeedback) {
        setFeedback({ tone: "danger", message });
      }
    }

    setDialogRequest?.("idle");
    if (!setDialogRequest) {
      setRequestState("idle");
    }
  }

  async function testDraftConnection(
    targetDraft: AiConnectionDraft,
    secretInput: string,
    setDialogFeedback?: (message: string | null) => void,
    setDialogRequest?: (state: RequestState) => void
  ): Promise<boolean> {
    const secret = await resolveSecret(targetDraft, secretInput);

    if (!secret) {
      const message = AI_COPY.missingKey;
      setDialogFeedback?.(message);
      if (!setDialogFeedback) {
        setFeedback({ tone: "warning", message });
      }
      return false;
    }

    setDialogRequest?.("testing");
    if (!setDialogRequest) {
      setRequestState("testing");
    }
    const result = await testAiConnection(targetDraft, secret);

    if (result.ok) {
      setDialogFeedback?.(AI_COPY.connectionOk);
      if (!setDialogFeedback) {
        setFeedback({ tone: "success", message: AI_COPY.connectionOk });
        setTestedSuccessfully(true);
      }
    } else {
      const message = errorMessage(result.error);
      setDialogFeedback?.(message);
      if (!setDialogFeedback) {
        setFeedback({ tone: "danger", message });
        setTestedSuccessfully(false);
      }
    }

    setDialogRequest?.("idle");
    if (!setDialogRequest) {
      setRequestState("idle");
    }
    return result.ok;
  }

  async function saveCurrentDraft(): Promise<boolean> {
    if (!selectedConnection || !draft.selectedModel.trim()) {
      setFeedback({ tone: "warning", message: AI_COPY.missingModel });
      return false;
    }

    setRequestState("saving");
    let apiKeyRef = draft.apiKeyRef;

    if (draftSecret.trim()) {
      apiKeyRef = await sessionAiSecretStore.save(
        selectedConnection.id,
        draftSecret
      );
    }

    const now = new Date().toISOString();
    const nextConnection: AiConnection = {
      ...selectedConnection,
      ...draft,
      baseUrl: draft.baseUrl.trim().replace(/\/+$/, ""),
      selectedModel: draft.selectedModel.trim(),
      apiKeyRef,
      verificationStatus: !apiKeyRef
        ? "unconfigured"
        : testedSuccessfully
          ? "connected"
          : "unverified",
      lastTestedAt: testedSuccessfully ? now : selectedConnection.lastTestedAt,
      updatedAt: now
    };

    updateAiSettings((current) => ({
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === nextConnection.id ? nextConnection : connection
      )
    }));
    setDraft(toDraft(nextConnection));
    setDraftSecret("");
    setFeedback({ tone: "success", message: AI_COPY.saved });
    setRequestState("idle");
    return true;
  }

  async function saveAndContinue() {
    const saved = await saveCurrentDraft();

    if (!saved || !pendingSelection) {
      return;
    }

    const connection = aiSettings.connections.find(
      (candidate) => candidate.id === pendingSelection.connectionId
    );
    setPendingSelection(null);

    if (connection) {
      resetEditor(connection);
    }
  }

  function discardAndContinue() {
    const connection = pendingSelection
      ? aiSettings.connections.find(
          (candidate) => candidate.id === pendingSelection.connectionId
        )
      : null;
    setPendingSelection(null);

    if (connection) {
      resetEditor(connection);
    }
  }

  function updateDraft(patch: Partial<AiConnectionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setFeedback(null);
  }

  async function clearCurrentSecret() {
    if (draft.apiKeyRef) {
      await sessionAiSecretStore.remove(draft.apiKeyRef);
    }

    updateDraft({ apiKeyRef: null });
    setDraftSecret("");
    setTestedSuccessfully(false);
  }

  function openCreateDialog() {
    setCustomDialog({
      mode: "create",
      draft: createEmptyCustomDraft(),
      secret: "",
      requestState: "idle",
      feedback: null
    });
  }

  function openEditDialog() {
    if (!selectedConnection || selectedConnection.kind !== "custom") {
      return;
    }

    setCustomDialog({
      mode: "edit",
      draft: toDraft(selectedConnection),
      secret: "",
      requestState: "idle",
      feedback: null
    });
  }

  async function saveCustomDialog() {
    if (!customDialog) {
      return;
    }

    setCustomDialog((current) =>
      current ? { ...current, requestState: "saving" } : current
    );
    const now = new Date().toISOString();

    if (customDialog.mode === "create") {
      let nextSettings = createCustomConnection(
        aiSettings,
        {
          displayName: customDialog.draft.displayName,
          baseUrl: customDialog.draft.baseUrl,
          selectedModel: customDialog.draft.selectedModel
        },
        { id: customDialog.draft.id, now }
      );
      let apiKeyRef: string | null = null;

      if (customDialog.secret.trim()) {
        apiKeyRef = await sessionAiSecretStore.save(
          customDialog.draft.id,
          customDialog.secret
        );
      }

      nextSettings = {
        ...nextSettings,
        connections: nextSettings.connections.map((connection) =>
          connection.id === customDialog.draft.id
            ? {
                ...connection,
                apiKeyRef,
                discoveredModels: [...customDialog.draft.discoveredModels],
                modelsFetchedAt: customDialog.draft.modelsFetchedAt,
                verificationStatus: apiKeyRef ? "unverified" : "unconfigured"
              }
            : connection
        )
      };
      updateAiSettings(() => nextSettings);
      const created = nextSettings.connections.find(
        (connection) => connection.id === customDialog.draft.id
      );

      if (created) {
        resetEditor(created);
      }
    } else {
      let nextSettings = renameConnection(
        aiSettings,
        customDialog.draft.id,
        customDialog.draft.displayName,
        now
      );
      let apiKeyRef = customDialog.draft.apiKeyRef;

      if (customDialog.secret.trim()) {
        apiKeyRef = await sessionAiSecretStore.save(
          customDialog.draft.id,
          customDialog.secret
        );
      }

      nextSettings = {
        ...nextSettings,
        connections: nextSettings.connections.map((connection) =>
          connection.id === customDialog.draft.id
            ? {
                ...connection,
                baseUrl: customDialog.draft.baseUrl,
                selectedModel: customDialog.draft.selectedModel,
                discoveredModels: [...customDialog.draft.discoveredModels],
                modelsFetchedAt: customDialog.draft.modelsFetchedAt,
                apiKeyRef,
                verificationStatus: apiKeyRef ? "unverified" : "unconfigured",
                updatedAt: now
              }
            : connection
        )
      };
      updateAiSettings(() => nextSettings);
      const edited = nextSettings.connections.find(
        (connection) => connection.id === customDialog.draft.id
      );

      if (edited) {
        resetEditor(edited);
      }
    }

    setCustomDialog(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.apiKeyRef) {
      await sessionAiSecretStore.remove(deleteTarget.apiKeyRef);
    }

    const nextSettings = deleteConnection(aiSettings, deleteTarget.id);
    updateAiSettings(() => nextSettings);
    const nextConnection = nextSettings.connections[0];

    if (nextConnection) {
      resetEditor(nextConnection);
    }

    setDeleteTarget(null);
  }

  function updateRoute(
    key: keyof AiFeatureRouting,
    value: string
  ) {
    const target = valueToTarget(value);
    updateAiSettings((current) => ({
      ...current,
      featureRouting: {
        ...current.featureRouting,
        [key]: target ?? "inherit"
      }
    }));
  }

  const selectedProviderIcon =
    PROVIDER_ICONS[selectedConnection?.providerId ?? "openai-compatible"] ??
    Robot;
  const SelectedProviderIcon = selectedProviderIcon;
  const DefaultProviderIcon =
    PROVIDER_ICONS[
      currentDefaultConnection?.providerId ?? "openai-compatible"
    ] ?? Sparkle;
  const selectedStatus = dirty
    ? AI_COPY.dirty
    : selectedConnection
      ? STATUS_LABELS[selectedConnection.verificationStatus]
      : AI_COPY.unconfigured;
  const selectedStatusTone = dirty
    ? "dirty"
    : selectedConnection?.verificationStatus ?? "unconfigured";

  const actionMenuItems = useMemo<CompactActionMenuItem[]>(() => {
    if (!selectedConnection) {
      return [];
    }

    const baseItems: CompactActionMenuItem[] = [
      {
        id: "default",
        label: AI_COPY.setAsDefault,
        icon: Star,
        disabled: !selectedConnection.selectedModel || dirty,
        onSelect: () =>
          updateAiSettings((current) =>
            setGlobalDefault(
              current,
              selectedConnection.id,
              selectedConnection.selectedModel
            )
          )
      },
      {
        id: "toggle",
        label: selectedConnection.enabled ? AI_COPY.disable : AI_COPY.enable,
        icon: Power,
        onSelect: () =>
          updateAiSettings((current) =>
            toggleConnection(
              current,
              selectedConnection.id,
              !selectedConnection.enabled
            )
          )
      }
    ];

    if (selectedConnection.kind === "custom") {
      return [
        ...baseItems,
        {
          id: "rename",
          label: AI_COPY.rename,
          icon: PencilSimple,
          onSelect: openEditDialog
        },
        {
          id: "duplicate",
          label: AI_COPY.duplicate,
          icon: Copy,
          onSelect: () => {
            const nextId = createId();
            const next = duplicateConnectionWithoutSecret(
              aiSettings,
              selectedConnection.id,
              { id: nextId, now: new Date().toISOString() }
            );
            updateAiSettings(() => next);
            const duplicate = next.connections.find(
              (connection) => connection.id === nextId
            );
            if (duplicate) {
              resetEditor(duplicate);
            }
          }
        },
        {
          id: "delete",
          label: AI_COPY.delete,
          icon: Trash,
          danger: true,
          onSelect: () => setDeleteTarget(selectedConnection)
        }
      ];
    }

    return [
      ...baseItems,
      {
        id: "restore",
        label: AI_COPY.restoreEndpoint,
        icon: ArrowsClockwise,
        onSelect: () => {
          const definition = AI_PROVIDER_CATALOG.find(
            (provider) => provider.id === selectedConnection.providerId
          );
          if (definition) {
            updateDraft({ baseUrl: definition.defaultBaseUrl });
          }
        }
      },
      {
        id: "clear",
        label: AI_COPY.clearConfiguration,
        icon: Trash,
        danger: true,
        onSelect: async () => {
          await clearCurrentSecret();
          updateDraft({
            selectedModel: "",
            discoveredModels: [],
            modelsFetchedAt: null
          });
        }
      }
    ];
  }, [aiSettings, dirty, selectedConnection]);

  return (
    <div className="settings-ai">
      <section className="ai-default-summary">
        <div className="ai-default-summary__icon">
          {currentDefaultConnection ? (
            <DefaultProviderIcon aria-hidden="true" weight="regular" />
          ) : (
            <Sparkle aria-hidden="true" weight="regular" />
          )}
        </div>
        <div className="ai-default-summary__copy">
          <small>{AI_COPY.currentDefault}</small>
          <strong>
            {currentDefaultConnection && aiSettings.globalDefault
              ? `${currentDefaultConnection.displayName} · ${aiSettings.globalDefault.model}`
              : AI_COPY.noDefault}
          </strong>
          <span>
            {currentDefaultConnection
              ? STATUS_LABELS[currentDefaultConnection.verificationStatus]
              : AI_COPY.noDefaultHint}
          </span>
        </div>
        <button
          type="button"
          aria-label={AI_COPY.testConnection}
          title={AI_COPY.testConnection}
          disabled={!currentDefaultConnection}
          onClick={() => {
            if (currentDefaultConnection) {
              requestConnectionSelection(currentDefaultConnection.id);
            }
          }}
        >
          <PlugsConnected aria-hidden="true" />
        </button>
      </section>

      <AiSection icon={Sparkle} title={AI_COPY.aiServices}>
        <div className="ai-provider-grid">
          {AI_PROVIDER_CATALOG.map((provider) => {
            const connection = aiSettings.connections.find(
              (candidate) => candidate.id === `built-in:${provider.id}`
            );
            const Icon = PROVIDER_ICONS[provider.id];
            const isSelected = selectedConnection?.id === connection?.id;
            const isDefault =
              aiSettings.globalDefault?.connectionId === connection?.id;

            return (
              <button
                type="button"
                data-ai-provider="true"
                data-selected={isSelected || undefined}
                data-default={isDefault || undefined}
                key={provider.id}
                title={provider.displayName}
                onClick={() =>
                  connection && requestConnectionSelection(connection.id)
                }
              >
                <Icon aria-hidden="true" weight="regular" />
                <span>{provider.displayName}</span>
                <i
                  data-status={connection?.verificationStatus ?? "unconfigured"}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div className="ai-custom-selector">
          <span>{AI_COPY.customConnections}</span>
          <div>
            <SettingSelect
              ariaLabel={AI_COPY.customConnections}
              value={activeCustomId}
              options={customOptions}
              disabled={customConnections.length === 0}
              onChange={requestConnectionSelection}
            />
            <button
              type="button"
              aria-label={AI_COPY.addCustomConnection}
              title={AI_COPY.addCustomConnection}
              onClick={openCreateDialog}
            >
              <Plus aria-hidden="true" weight="bold" />
            </button>
            <span className="compact-menu-anchor">
              <button
                type="button"
                aria-label={AI_COPY.customConnectionActions}
                title={AI_COPY.customConnectionActions}
                disabled={selectedConnection?.kind !== "custom"}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <DotsThree aria-hidden="true" weight="bold" />
              </button>
              <CompactActionMenu
                ariaLabel={AI_COPY.connectionActions}
                open={menuOpen}
                items={actionMenuItems}
                onClose={() => setMenuOpen(false)}
              />
            </span>
          </div>
        </div>
      </AiSection>

      {selectedConnection ? (
        <AiSection
          icon={SelectedProviderIcon}
          title={`${selectedConnection.displayName} ${AI_COPY.configuration}`}
          action={
            <div className="ai-connection-heading-actions">
              <span
                className="ai-status-badge"
                data-status={selectedStatusTone}
              >
                {selectedStatus}
              </span>
              <span className="compact-menu-anchor">
                <button
                  className="settings-section__icon-action"
                  type="button"
                  aria-label={AI_COPY.connectionActions}
                  title={AI_COPY.connectionActions}
                  onClick={() =>
                    setConnectionMenuOpen((current) => !current)
                  }
                >
                  <DotsThree aria-hidden="true" weight="bold" />
                </button>
                <CompactActionMenu
                  ariaLabel={AI_COPY.connectionActions}
                  open={connectionMenuOpen}
                  items={actionMenuItems}
                  onClose={() => setConnectionMenuOpen(false)}
                />
              </span>
            </div>
          }
          className="ai-connection-section"
        >
          <div className="ai-connection-form">
            <label>
              <span>
                <Key aria-hidden="true" />
                {AI_COPY.apiKey}
              </span>
              <div className="ai-secret-input">
                <input
                  className="nyaworks-text-input"
                  type={showSecret ? "text" : "password"}
                  value={draftSecret}
                  autoComplete="off"
                  placeholder={
                    draft.apiKeyRef
                      ? AI_COPY.savedKeyPlaceholder
                      : AI_COPY.apiKeyPlaceholder
                  }
                  onChange={(event) => {
                    setDraftSecret(event.target.value);
                    setFeedback(null);
                    setTestedSuccessfully(false);
                  }}
                />
                <button
                  type="button"
                  aria-label={
                    showSecret ? AI_COPY.hideApiKey : AI_COPY.showApiKey
                  }
                  title={
                    showSecret ? AI_COPY.hideApiKey : AI_COPY.showApiKey
                  }
                  onClick={() => setShowSecret((current) => !current)}
                >
                  {showSecret ? (
                    <EyeSlash aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={AI_COPY.clearApiKey}
                  title={AI_COPY.clearApiKey}
                  disabled={!draft.apiKeyRef && !draftSecret}
                  onClick={clearCurrentSecret}
                >
                  <Trash aria-hidden="true" />
                </button>
              </div>
              <small>{AI_COPY.sessionOnly}</small>
            </label>

            <label>
              <span>
                <LinkSimple aria-hidden="true" />
                {AI_COPY.baseUrl}
              </span>
              <input
                className="nyaworks-text-input"
                value={draft.baseUrl}
                onChange={(event) =>
                  updateDraft({ baseUrl: event.target.value })
                }
              />
            </label>

            <label>
              <span>
                <Robot aria-hidden="true" />
                {AI_COPY.model}
              </span>
              <ModelComboBox
                ariaLabel={AI_COPY.model}
                value={draft.selectedModel}
                options={draft.discoveredModels}
                refreshLabel={AI_COPY.refreshModels}
                placeholder={AI_COPY.modelPlaceholder}
                loading={requestState === "loading-models"}
                error={feedback?.message ?? null}
                disabled={requestState === "saving"}
                onChange={(selectedModel) => updateDraft({ selectedModel })}
                onRefresh={() =>
                  refreshDraftModels(draft, draftSecret, updateDraft)
                }
              />
            </label>

            <div className="ai-connection-form__enabled">
              <span>{AI_COPY.enabled}</span>
              <AiSwitch
                checked={draft.enabled}
                label={AI_COPY.enabled}
                onChange={(enabled) => updateDraft({ enabled })}
              />
            </div>

            <div className="ai-connection-actions">
              <button
                type="button"
                disabled={requestState !== "idle"}
                onClick={() => testDraftConnection(draft, draftSecret)}
              >
                <PlugsConnected aria-hidden="true" />
                <span>{AI_COPY.testConnection}</span>
              </button>
              <button
                type="button"
                data-primary="true"
                disabled={!dirty || requestState !== "idle"}
                onClick={saveCurrentDraft}
              >
                <FloppyDisk aria-hidden="true" />
                <span>{AI_COPY.saveConfiguration}</span>
              </button>
            </div>
          </div>
        </AiSection>
      ) : null}

      <div className="ai-settings-columns">
        <AiSection icon={Brain} title={AI_COPY.modelRouting}>
          <div className="ai-routing-rows">
            <label>
              <span>{AI_COPY.globalDefaultModel}</span>
              <SettingSelect
                ariaLabel={AI_COPY.globalDefaultModel}
                value={targetToValue(aiSettings.globalDefault)}
                options={globalOptions}
                onChange={(value) => {
                  const target = valueToTarget(value);
                  updateAiSettings((current) => ({
                    ...current,
                    globalDefault: target
                  }));
                }}
              />
            </label>
            {(
              [
                ["chat", AI_COPY.chat, AI_COPY.chatModel, ChatCircleDots],
                [
                  "expression",
                  AI_COPY.expression,
                  AI_COPY.expressionModel,
                  FunctionIcon
                ],
                ["script", AI_COPY.script, AI_COPY.scriptModel, Code]
              ] as const
            ).map(([key, label, ariaLabel, Icon]) => (
              <label key={key}>
                <span>
                  <Icon aria-hidden="true" />
                  {label}
                </span>
                <SettingSelect
                  ariaLabel={ariaLabel}
                  value={routeToValue(aiSettings.featureRouting[key])}
                  options={routeOptions}
                  onChange={(value) => updateRoute(key, value)}
                />
              </label>
            ))}
          </div>
        </AiSection>

        <AiSection icon={SlidersHorizontal} title={AI_COPY.generation}>
          <div className="ai-preference-rows">
            <label>
              <span>{AI_COPY.creativity}</span>
              <div className="ai-range-control">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={aiSettings.generation.creativity}
                  aria-label={AI_COPY.creativity}
                  onChange={(event) =>
                    updateAiSettings((current) => ({
                      ...current,
                      generation: {
                        ...current.generation,
                        creativity: Number(event.target.value)
                      }
                    }))
                  }
                />
                <output>{aiSettings.generation.creativity}%</output>
              </div>
            </label>
            <label>
              <span>{AI_COPY.outputLength}</span>
              <SettingSelect
                ariaLabel={AI_COPY.outputLength}
                value={aiSettings.generation.maxOutputTokens}
                options={[
                  { value: 2048, label: AI_COPY.outputShort },
                  { value: 4096, label: AI_COPY.outputMedium },
                  { value: 8192, label: AI_COPY.outputLong }
                ]}
                onChange={(maxOutputTokens) =>
                  updateAiSettings((current) => ({
                    ...current,
                    generation: {
                      ...current.generation,
                      maxOutputTokens
                    }
                  }))
                }
              />
            </label>
            <label>
              <span>{AI_COPY.streaming}</span>
              <AiSwitch
                checked={aiSettings.generation.streaming}
                label={AI_COPY.streaming}
                onChange={(streaming) =>
                  updateAiSettings((current) => ({
                    ...current,
                    generation: { ...current.generation, streaming }
                  }))
                }
              />
            </label>
            <label>
              <span>{AI_COPY.timeout}</span>
              <SettingSelect
                ariaLabel={AI_COPY.timeout}
                value={aiSettings.generation.timeoutMs}
                options={[
                  { value: 30000, label: "30 s" },
                  { value: 60000, label: "60 s" },
                  { value: 120000, label: "120 s" }
                ]}
                onChange={(timeoutMs) =>
                  updateAiSettings((current) => ({
                    ...current,
                    generation: { ...current.generation, timeoutMs }
                  }))
                }
              />
            </label>
            <label>
              <span>{AI_COPY.retry}</span>
              <SettingSelect
                ariaLabel={AI_COPY.retry}
                value={aiSettings.generation.retryCount}
                options={[
                  { value: 0, label: "0" },
                  { value: 1, label: "1" },
                  { value: 2, label: "2" },
                  { value: 3, label: "3" }
                ]}
                onChange={(retryCount) =>
                  updateAiSettings((current) => ({
                    ...current,
                    generation: { ...current.generation, retryCount }
                  }))
                }
              />
            </label>
          </div>
        </AiSection>
      </div>

      <AiSection icon={ShieldCheck} title={AI_COPY.privacy}>
        <div className="ai-privacy-grid">
          <label>
            <span>{AI_COPY.saveHistory}</span>
            <AiSwitch
              checked={aiSettings.saveConversationHistory}
              label={AI_COPY.saveHistory}
              onChange={(saveConversationHistory) =>
                updateAiSettings((current) => ({
                  ...current,
                  saveConversationHistory
                }))
              }
            />
          </label>
          <label>
            <span>{AI_COPY.includeAeContext}</span>
            <AiSwitch
              checked={aiSettings.includeAeContext}
              label={AI_COPY.includeAeContext}
              onChange={(includeAeContext) =>
                updateAiSettings((current) => ({
                  ...current,
                  includeAeContext
                }))
              }
            />
          </label>
          <div className="ai-privacy-actions">
            <button
              type="button"
              onClick={() =>
                setFeedback({
                  tone: "success",
                  message: AI_COPY.historyCleared
                })
              }
            >
              <Database aria-hidden="true" />
              <span>{AI_COPY.clearHistory}</span>
            </button>
            <button
              type="button"
              data-danger="true"
              onClick={() => setClearAllOpen(true)}
            >
              <Trash aria-hidden="true" />
              <span>{AI_COPY.clearAll}</span>
            </button>
          </div>
          <small>{AI_COPY.localOnly}</small>
        </div>
      </AiSection>

      {pendingSelection ? (
        <AppDialog
          title={AI_COPY.unsavedTitle}
          description={AI_COPY.unsavedBody}
          primaryAction={{
            label: AI_COPY.saveAndContinue,
            onClick: saveAndContinue
          }}
          secondaryAction={{
            label: AI_COPY.discardAndContinue,
            onClick: discardAndContinue
          }}
          onClose={() => setPendingSelection(null)}
        />
      ) : null}

      {customDialog ? (
        <AiConnectionDialog
          mode={customDialog.mode}
          draft={customDialog.draft}
          secret={customDialog.secret}
          existingNames={customConnections
            .filter(
              (connection) =>
                customDialog.mode === "create" ||
                connection.id !== customDialog.draft.id
            )
            .map((connection) => connection.displayName)}
          labels={{
            createTitle: AI_COPY.newConnectionTitle,
            editTitle: AI_COPY.editConnectionTitle,
            connectionName: AI_COPY.connectionName,
            connectionNamePlaceholder: AI_COPY.connectionNamePlaceholder,
            protocol: AI_COPY.protocol,
            protocolValue: AI_COPY.protocolValue,
            apiKey: AI_COPY.apiKey,
            apiKeyPlaceholder: AI_COPY.apiKeyPlaceholder,
            baseUrl: AI_COPY.baseUrl,
            baseUrlPlaceholder: AI_COPY.baseUrlPlaceholder,
            model: AI_COPY.model,
            modelPlaceholder: AI_COPY.modelPlaceholder,
            refreshModels: AI_COPY.refreshModels,
            testConnection: AI_COPY.testConnection,
            createAndSave: AI_COPY.createAndSave,
            save: AI_COPY.save,
            cancel: AI_COPY.cancel,
            nameRequired: AI_COPY.nameRequired,
            nameDuplicate: AI_COPY.nameDuplicate,
            invalidUrl: AI_COPY.invalidUrl,
            showSecret: AI_COPY.showApiKey,
            hideSecret: AI_COPY.hideApiKey
          }}
          requestState={customDialog.requestState}
          feedback={customDialog.feedback}
          onDraftChange={(patch) =>
            setCustomDialog((current) =>
              current
                ? {
                    ...current,
                    draft: { ...current.draft, ...patch },
                    feedback: null
                  }
                : current
            )
          }
          onSecretChange={(secret) =>
            setCustomDialog((current) =>
              current ? { ...current, secret, feedback: null } : current
            )
          }
          onRefreshModels={() =>
            refreshDraftModels(
              customDialog.draft,
              customDialog.secret,
              (patch) =>
                setCustomDialog((current) =>
                  current
                    ? {
                        ...current,
                        draft: { ...current.draft, ...patch }
                      }
                    : current
                ),
              (message) =>
                setCustomDialog((current) =>
                  current ? { ...current, feedback: message } : current
                ),
              (nextRequestState) =>
                setCustomDialog((current) =>
                  current
                    ? { ...current, requestState: nextRequestState }
                    : current
                )
            )
          }
          onTestConnection={() =>
            testDraftConnection(
              customDialog.draft,
              customDialog.secret,
              (message) =>
                setCustomDialog((current) =>
                  current ? { ...current, feedback: message } : current
                ),
              (nextRequestState) =>
                setCustomDialog((current) =>
                  current
                    ? { ...current, requestState: nextRequestState }
                    : current
                )
            )
          }
          onSave={saveCustomDialog}
          onCancel={() => setCustomDialog(null)}
        />
      ) : null}

      {deleteTarget ? (
        <AppDialog
          title={AI_COPY.deleteTitle}
          description={AI_COPY.deleteBody}
          primaryAction={{
            label: AI_COPY.confirmDelete,
            onClick: confirmDelete
          }}
          secondaryAction={{
            label: AI_COPY.cancel,
            onClick: () => setDeleteTarget(null)
          }}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}

      {clearAllOpen ? (
        <AppDialog
          title={AI_COPY.clearAllTitle}
          description={AI_COPY.clearAllBody}
          primaryAction={{
            label: AI_COPY.confirmClearAll,
            onClick: async () => {
              await sessionAiSecretStore.clear();
              resetAiSettings();
              const firstDefault = aiSettings.connections.find(
                (connection) => connection.id === "built-in:openai"
              );
              if (firstDefault) {
                resetEditor({
                  ...firstDefault,
                  apiKeyRef: null,
                  selectedModel: "",
                  discoveredModels: [],
                  modelsFetchedAt: null,
                  verificationStatus: "unconfigured",
                  lastTestedAt: null
                });
              }
              setClearAllOpen(false);
            }
          }}
          secondaryAction={{
            label: AI_COPY.cancel,
            onClick: () => setClearAllOpen(false)
          }}
          onClose={() => setClearAllOpen(false)}
        />
      ) : null}
    </div>
  );
}

