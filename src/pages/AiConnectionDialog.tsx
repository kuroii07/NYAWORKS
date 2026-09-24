import { Eye, EyeSlash, PlugsConnected } from "@phosphor-icons/react";
import { useState } from "react";
import type { AiConnectionDraft } from "../aiSettings/types";
import { AppDialog } from "../components/AppDialog";
import { ModelComboBox } from "../components/ModelComboBox";

export type AiConnectionDialogRequestState =
  | "idle"
  | "testing"
  | "loading-models"
  | "saving";

export interface AiConnectionDialogLabels {
  createTitle: string;
  editTitle: string;
  connectionName: string;
  connectionNamePlaceholder: string;
  protocol: string;
  protocolValue: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  baseUrl: string;
  baseUrlPlaceholder: string;
  model: string;
  modelPlaceholder: string;
  refreshModels: string;
  testConnection: string;
  createAndSave: string;
  save: string;
  cancel: string;
  nameRequired: string;
  nameDuplicate: string;
  invalidUrl: string;
  showSecret: string;
  hideSecret: string;
}

interface AiConnectionDialogProps {
  mode: "create" | "edit";
  draft: AiConnectionDraft;
  secret: string;
  existingNames: readonly string[];
  labels: AiConnectionDialogLabels;
  requestState: AiConnectionDialogRequestState;
  feedback: string | null;
  onDraftChange: (patch: Partial<AiConnectionDraft>) => void;
  onSecretChange: (secret: string) => void;
  onRefreshModels: () => void;
  onTestConnection: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function validateCustomConnectionName(
  value: string,
  existingNames: readonly string[],
  labels: Pick<
    AiConnectionDialogLabels,
    "nameRequired" | "nameDuplicate"
  >
): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return labels.nameRequired;
  }

  return existingNames.some(
    (name) => name.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase()
  )
    ? labels.nameDuplicate
    : null;
}

function isValidEndpoint(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function AiConnectionDialog({
  mode,
  draft,
  secret,
  existingNames,
  labels,
  requestState,
  feedback,
  onDraftChange,
  onSecretChange,
  onRefreshModels,
  onTestConnection,
  onSave,
  onCancel
}: AiConnectionDialogProps) {
  const [showSecret, setShowSecret] = useState(false);
  const nameError = validateCustomConnectionName(
    draft.displayName,
    existingNames,
    labels
  );
  const urlError = isValidEndpoint(draft.baseUrl) ? null : labels.invalidUrl;
  const isBusy = requestState !== "idle";
  const canSave = !nameError && !urlError && Boolean(draft.selectedModel.trim());

  return (
    <AppDialog
      title={mode === "create" ? labels.createTitle : labels.editTitle}
      primaryAction={{
        label: mode === "create" ? labels.createAndSave : labels.save,
        disabled: !canSave || isBusy,
        onClick: onSave
      }}
      secondaryAction={{
        label: labels.cancel,
        onClick: onCancel
      }}
      onClose={onCancel}
    >
      <div className="ai-connection-dialog">
        <label>
          <span>{labels.connectionName}</span>
          <input
            className="nyaworks-text-input"
            value={draft.displayName}
            maxLength={32}
            aria-invalid={Boolean(nameError)}
            placeholder={labels.connectionNamePlaceholder}
            onChange={(event) =>
              onDraftChange({ displayName: event.target.value })
            }
          />
          {nameError ? (
            <small className="nyaworks-field-error" role="alert">
              {nameError}
            </small>
          ) : null}
        </label>

        <label>
          <span>{labels.protocol}</span>
          <output className="ai-connection-dialog__protocol">
            {labels.protocolValue}
          </output>
        </label>

        <label>
          <span>{labels.apiKey}</span>
          <div className="ai-secret-input">
            <input
              className="nyaworks-text-input"
              type={showSecret ? "text" : "password"}
              value={secret}
              autoComplete="off"
              placeholder={labels.apiKeyPlaceholder}
              onChange={(event) => onSecretChange(event.target.value)}
            />
            <button
              type="button"
              aria-label={showSecret ? labels.hideSecret : labels.showSecret}
              title={showSecret ? labels.hideSecret : labels.showSecret}
              onClick={() => setShowSecret((current) => !current)}
            >
              {showSecret ? (
                <EyeSlash aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
            </button>
          </div>
        </label>

        <label>
          <span>{labels.baseUrl}</span>
          <input
            className="nyaworks-text-input"
            value={draft.baseUrl}
            aria-invalid={Boolean(urlError)}
            placeholder={labels.baseUrlPlaceholder}
            onChange={(event) => onDraftChange({ baseUrl: event.target.value })}
          />
          {urlError ? (
            <small className="nyaworks-field-error" role="alert">
              {urlError}
            </small>
          ) : null}
        </label>

        <label>
          <span>{labels.model}</span>
          <ModelComboBox
            ariaLabel={labels.model}
            value={draft.selectedModel}
            options={draft.discoveredModels}
            refreshLabel={labels.refreshModels}
            placeholder={labels.modelPlaceholder}
            loading={requestState === "loading-models"}
            error={feedback}
            disabled={requestState === "saving"}
            onChange={(selectedModel) => onDraftChange({ selectedModel })}
            onRefresh={onRefreshModels}
          />
        </label>

        <button
          className="ai-connection-dialog__test"
          type="button"
          disabled={isBusy || !isValidEndpoint(draft.baseUrl)}
          onClick={onTestConnection}
        >
          <PlugsConnected aria-hidden="true" />
          <span>{labels.testConnection}</span>
        </button>
      </div>
    </AppDialog>
  );
}
