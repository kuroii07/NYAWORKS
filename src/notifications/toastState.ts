export const DEFAULT_TOAST_DURATION = 3000;
export const MAX_TOAST_COUNT = 3;

export type ToastKind = "success" | "error" | "warning" | "info";

export interface ToastRecord {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
}

export function addToast(
  current: readonly ToastRecord[],
  next: ToastRecord
): ToastRecord[] {
  if (current.some((toast) => toast.kind === next.kind && toast.message === next.message)) {
    return [...current];
  }

  return [...current, next].slice(-MAX_TOAST_COUNT);
}

export function dismissToast(
  current: readonly ToastRecord[],
  id: string
): ToastRecord[] {
  return current.filter((toast) => toast.id !== id);
}
