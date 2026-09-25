import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

export interface AppDialogAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface AppDialogProps {
  title: string;
  description?: string;
  children?: ReactNode;
  primaryAction: AppDialogAction;
  secondaryAction?: AppDialogAction;
  tertiaryAction?: AppDialogAction;
  onClose: () => void;
}

export function AppDialog({
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  onClose
}: AppDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    primaryActionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, []);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  const dialog = (
    <div
      className="app-dialog-layer"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <section
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-dialog__header">
          <span className="app-dialog__brand">NYAWORKS</span>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        {children ? <div className="app-dialog__content">{children}</div> : null}
        <div className="app-dialog__actions">
          {tertiaryAction ? (
            <button
              className="app-dialog__button app-dialog__button--tertiary"
              type="button"
              disabled={tertiaryAction.disabled}
              onClick={tertiaryAction.onClick}
            >
              {tertiaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              className="app-dialog__button app-dialog__button--secondary"
              type="button"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          ) : null}
          <button
            ref={primaryActionRef}
            className="app-dialog__button app-dialog__button--primary"
            type="button"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </button>
        </div>
      </section>
    </div>
  );

  return typeof document === "undefined"
    ? dialog
    : createPortal(dialog, document.body);
}
