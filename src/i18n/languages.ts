export const LANGUAGE_IDS = ["zh-CN", "zh-TW", "en", "ja", "ko"] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];

export const DEFAULT_LANGUAGE_ID: LanguageId = "zh-CN";

export interface LanguageDefinition {
  id: LanguageId;
  mark: string;
  nativeName: string;
  englishName: string;
}

export const LANGUAGES: readonly LanguageDefinition[] = [
  {
    id: "zh-CN",
    mark: "简",
    nativeName: "简体中文",
    englishName: "Simplified Chinese"
  },
  {
    id: "zh-TW",
    mark: "繁",
    nativeName: "繁體中文",
    englishName: "Traditional Chinese"
  },
  { id: "en", mark: "En", nativeName: "English", englishName: "English" },
  { id: "ja", mark: "あ", nativeName: "日本語", englishName: "Japanese" },
  { id: "ko", mark: "한", nativeName: "한국어", englishName: "Korean" }
] as const;

type LanguageButtonLabel =
  | readonly [primary: string]
  | readonly [primary: string, secondary: string];

const LANGUAGE_BUTTON_LABELS: Record<LanguageId, LanguageButtonLabel> = {
  "zh-CN": ["中", "En"],
  en: ["中", "En"],
  "zh-TW": ["繁"],
  ja: ["あ"],
  ko: ["한"]
};

export function getNextLanguageId(languageId: LanguageId): LanguageId {
  return languageId === DEFAULT_LANGUAGE_ID ? "en" : DEFAULT_LANGUAGE_ID;
}

export function getLanguageButtonLabel(
  languageId: LanguageId
): LanguageButtonLabel {
  return LANGUAGE_BUTTON_LABELS[languageId];
}
