import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { useTheme } from "../theme/ThemeProvider";
import {
  textLayerEditorBridge,
  type TextLayerEditorBridge,
  type TextLayerEditorFailureReason
} from "../host/textLayerEditorBridge";
import {
  textEditorAppearanceBridge,
  type TextEditorAppearanceBridge
} from "../host/textEditorAppearanceBridge";
import { prepareTextLayerEditorKeyboard } from "./cepLauncher";
import { startTextEditorAppearanceSubscriber } from "./appearanceSync";

interface TextLayerEditorProps {
  bridge?: TextLayerEditorBridge;
  appearanceBridge?: TextEditorAppearanceBridge;
  prepareKeyboard?: () => void;
}

type StatusTone = "neutral" | "success" | "error" | "dirty";

export function TextLayerEditor({
  bridge = textLayerEditorBridge,
  appearanceBridge = textEditorAppearanceBridge,
  prepareKeyboard = prepareTextLayerEditorKeyboard
}: TextLayerEditorProps) {
  const { copy, setLanguage } = useLanguage();
  const { setTheme } = useTheme();
  const labels = copy.home.textLayerDialog;
  const [text, setText] = useState("");
  const [target, setTarget] = useState<{
    id: string;
    name: string;
    appliedText: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(labels.idleStatus);
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = text.length > 0;

  useEffect(() => {
    prepareKeyboard();
    textAreaRef.current?.focus();
    void handleRead(true);
  }, [prepareKeyboard]);

  useEffect(
    () => startTextEditorAppearanceSubscriber(({ themeId, languageId }) => {
      setTheme(themeId);
      setLanguage(languageId);
    }, appearanceBridge),
    [appearanceBridge, setLanguage, setTheme]
  );

  useEffect(() => {
    if (statusTone === "neutral") setStatus(labels.idleStatus);
  }, [labels.idleStatus, statusTone]);

  const failureLabels = useMemo<Record<TextLayerEditorFailureReason, string>>(
    () => ({
      unavailable: labels.unavailable,
      "invalid-host-response": labels.hostError,
      "no-active-comp": labels.noActiveComp,
      "invalid-selection": labels.selectOneLayer,
      "unsupported-layer-type": labels.selectTextLayer,
      "empty-text": labels.emptyText,
      "invalid-target": labels.invalidTarget,
      "host-error": labels.hostError
    }),
    [labels]
  );

  function showFailure(reason: TextLayerEditorFailureReason) {
    setStatus(failureLabels[reason]);
    setStatusTone("error");
  }

  async function handleRead(silent = false) {
    setBusy(true);
    try {
      const result = await bridge.readSelectedTextLayer();
      if (!result.ok) {
        setTarget(null);
        if (!silent) showFailure(result.reason);
        return;
      }
      setText(result.text);
      setTarget({
        id: result.targetId,
        name: result.layerName,
        appliedText: result.text
      });
      setStatus(labels.readSuccess.replace("{name}", result.layerName));
      setStatusTone("success");
      textAreaRef.current?.focus();
    } catch {
      setTarget(null);
      if (!silent) showFailure("host-error");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!target || busy) return;
    const currentTarget = target;
    setBusy(true);
    try {
      const result = await bridge.applyText(currentTarget.id, text);
      if (!result.ok) {
        if (result.reason === "invalid-target") setTarget(null);
        showFailure(result.reason);
        return;
      }
      setTarget({ ...currentTarget, appliedText: text });
      setStatus(labels.applySuccess.replace("{name}", currentTarget.name));
      setStatusTone("success");
    } catch {
      showFailure("host-error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!hasText || busy) return;
    setBusy(true);
    try {
      const result = await bridge.createText(text);
      if (!result.ok) {
        showFailure(result.reason);
        return;
      }
      setStatus(labels.createSuccess);
      setStatusTone("success");
    } catch {
      showFailure("host-error");
    } finally {
      setBusy(false);
    }
  }

  function handleTextChange(nextText: string) {
    setText(nextText);
    if (!target) return;
    setStatus(
      nextText === target.appliedText
        ? labels.readSuccess.replace("{name}", target.name)
        : labels.dirtyStatus
    );
    setStatusTone(nextText === target.appliedText ? "success" : "dirty");
  }

  return (
    <main className="text-editor-shell">
      <header className="text-editor-header">
        <div>
          <span className="text-editor-kicker">NYAWORKS</span>
          <h1>{labels.title}</h1>
        </div>
      </header>

      <section className="text-editor-body">
        <textarea
          ref={textAreaRef}
          value={text}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          spellCheck={false}
          onFocus={prepareKeyboard}
          onPointerDown={(event) => {
            prepareKeyboard();
            event.currentTarget.focus();
          }}
          onInput={(event) => handleTextChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === "Enter") {
              event.preventDefault();
              if (target) {
                void handleApply();
              } else {
                void handleCreate();
              }
            }
          }}
        />

        <div className="text-editor-status-row">
          <p className="text-editor-status" data-tone={statusTone} role="status">
            {busy ? labels.processing : status}
          </p>
          <span className="text-editor-count">{text.length}</span>
        </div>

        <div className="text-editor-footer">
          <div className="text-editor-actions">
            <button type="button" disabled={busy} onClick={() => void handleRead(false)}>
              {labels.read}
            </button>
            <button
              className="text-editor-action--apply"
              type="button"
              disabled={busy || !target}
              onClick={() => void handleApply()}
            >
              {labels.apply}
            </button>
            <button
              className="text-editor-action--primary"
              type="button"
              disabled={busy || !hasText}
              onClick={() => void handleCreate()}
            >
              {labels.create}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
