import { DEFAULT_LANGUAGE_ID, LANGUAGE_IDS, type LanguageId } from "../i18n/languages";

// Payloads also arrive from old callers and untyped CEP/JSX boundaries.
export function resolveLayerLanguage(languageId?: unknown): LanguageId {
  return LANGUAGE_IDS.find(id => id === languageId) ?? DEFAULT_LANGUAGE_ID;
}
