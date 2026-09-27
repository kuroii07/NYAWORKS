import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import {
  CheckCircle,
  Info,
  Warning,
  WarningCircle,
  X
} from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  addToast,
  DEFAULT_TOAST_DURATION,
  dismissToast,
  type ToastKind,
  type ToastRecord
} from "./toastState";

interface ToastOptions {
  duration?: number;
}

interface ToastApi {
  toast: {
    success(message: string, options?: ToastOptions): void;
    error(message: string, options?: ToastOptions): void;
    warning(message: string, options?: ToastOptions): void;
    info(message: string, options?: ToastOptions): void;
  };
}

const ToastContext = createContext<ToastApi>({
  toast: {
    success: () => undefined,
    error: () => undefined,
    warning: () => undefined,
    info: () => undefined
  }
});

const TOAST_ICONS = {
  success: CheckCircle,
  error: WarningCircle,
  warning: Warning,
  info: Info
} satisfies Record<ToastKind, typeof CheckCircle>;

function ToastIcon({ kind }: { kind: ToastKind }) {
  const Icon = TOAST_ICONS[kind];
  return <Icon aria-hidden="true" weight="regular" />;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const { copy } = useLanguage();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => dismissToast(current, id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, options?: ToastOptions) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const duration = Math.max(1200, options?.duration ?? DEFAULT_TOAST_DURATION);
      const next: ToastRecord = { id, kind, message: trimmedMessage, duration };

      setToasts((current) => addToast(current, next));
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  const value = useMemo<ToastApi>(
    () => ({
      toast: {
        success: (message, options) => push("success", message, options),
        error: (message, options) => push("error", message, options),
        warning: (message, options) => push("warning", message, options),
        info: (message, options) => push("info", message, options)
      }
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-label={copy.toastRegion} aria-live="polite">
        {toasts.map((item) => (
          <div
            className="toast-item"
            data-kind={item.kind}
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
          >
            <span className="toast-item__icon">
              <ToastIcon kind={item.kind} />
            </span>
            <span className="toast-item__message">{item.message}</span>
            <button
              aria-label={copy.toastClose}
              className="toast-item__close"
              type="button"
              onClick={() => dismiss(item.id)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
