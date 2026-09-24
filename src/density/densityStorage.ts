import {
  DEFAULT_DENSITY_ID,
  DENSITY_IDS,
  type DensityId
} from "./types";

export const DENSITY_STORAGE_KEY = "nyaworks.density.v1";

interface DensityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isDensityId(value: unknown): value is DensityId {
  return (
    typeof value === "string" && DENSITY_IDS.includes(value as DensityId)
  );
}

export function readStoredDensity(storage?: DensityStorage): DensityId {
  if (!storage) {
    return DEFAULT_DENSITY_ID;
  }

  try {
    const storedValue = storage.getItem(DENSITY_STORAGE_KEY);
    return isDensityId(storedValue) ? storedValue : DEFAULT_DENSITY_ID;
  } catch {
    return DEFAULT_DENSITY_ID;
  }
}

export function writeStoredDensity(
  densityId: DensityId,
  storage?: DensityStorage
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(DENSITY_STORAGE_KEY, densityId);
  } catch {
    // CEP can run with storage disabled. Keep the active session usable.
  }
}
