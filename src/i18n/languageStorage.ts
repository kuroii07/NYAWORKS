import {
  DEFAULT_LANGUAGE_ID,
  LANGUAGE_IDS,
  type LanguageId
} from "./languages";

export const LANGUAGE_STORAGE_KEY = "nyaworks.language.v1";

interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isLanguageId(value: unknown): value is LanguageId {
  return (
    typeof value === "string" && LANGUAGE_IDS.includes(value as LanguageId)
  );
}

export function readStoredLanguage(storage?: LanguageStorage): LanguageId {
  if (!storage) {
    return DEFAULT_LANGUAGE_ID;
  }

  try {
    const storedValue = storage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageId(storedValue) ? storedValue : DEFAULT_LANGUAGE_ID;
  } catch {
    return DEFAULT_LANGUAGE_ID;
  }
}

export function writeStoredLanguage(
  languageId: LanguageId,
  storage?: LanguageStorage
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, languageId);
  } catch {
    // CEP can run with storage disabled. Keep the active session usable.
  }
}
