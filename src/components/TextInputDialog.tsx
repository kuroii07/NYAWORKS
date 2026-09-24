import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { AppDialog } from "./AppDialog";

interface TextInputDialogProps {
  title: string;
  description?: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  error?: string | null;
  confirmLabel: string;
  cancelLabel: string;
  children?: ReactNode;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TextInputDialog({
  title,
  description,
  value,
  placeholder,
  maxLength,
  error,
  confirmLabel,
  cancelLabel,
  children,
  onValueChange,
  onConfirm,
  onCancel
}: TextInputDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canConfirm = Boolean(value.trim()) && !error;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && canConfirm) {
      event.preventDefault();
      onConfirm();
    }
  }

  return (
    <AppDialog
      title={title}
      description={description}
      primaryAction={{
        label: confirmLabel,
        onClick: canConfirm ? onConfirm : () => undefined
      }}
      secondaryAction={{
        label: cancelLabel,
        onClick: onCancel
      }}
      onClose={onCancel}
    >
      <div className="nyaworks-text-dialog">
        <input
          ref={inputRef}
          className="nyaworks-text-input"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {children}
        {error ? (
          <span className="nyaworks-field-error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </AppDialog>
  );
}
