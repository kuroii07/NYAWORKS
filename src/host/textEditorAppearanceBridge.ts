import { LANGUAGE_IDS, type LanguageId } from "../i18n/languages";
import { THEME_IDS, type ThemeId } from "../theme/types";
import { evaluateHostScript, type CepEnvironment } from "./cepBridge";

export interface TextEditorAppearance {
  themeId: ThemeId;
  languageId: LanguageId;
}

export interface TextEditorAppearanceBridge {
  writeAppearance(appearance: TextEditorAppearance): Promise<boolean>;
  readAppearance(): Promise<TextEditorAppearance | null>;
}

function encodePayload(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function parseAppearance(result: string | null): TextEditorAppearance | null {
  if (result === null) return null;
  try {
    const parsed = JSON.parse(result) as {
      ok?: unknown;
      appearance?: { themeId?: unknown; languageId?: unknown };
    };
    const appearance = parsed.appearance;
    if (
      parsed.ok !== true ||
      !appearance ||
      !THEME_IDS.includes(appearance.themeId as ThemeId) ||
      !LANGUAGE_IDS.includes(appearance.languageId as LanguageId)
    ) {
      return null;
    }
    return {
      themeId: appearance.themeId as ThemeId,
      languageId: appearance.languageId as LanguageId
    };
  } catch {
    return null;
  }
}

export function createTextEditorAppearanceBridge(
  environment?: CepEnvironment
): TextEditorAppearanceBridge {
  return {
    async writeAppearance(appearance) {
      const encoded = encodePayload(appearance);
      const result = await evaluateHostScript(
        `NYAWORKS.setTextEditorAppearance(${JSON.stringify(encoded)})`,
        environment
      );
      if (result === null) return false;
      try {
        return (JSON.parse(result) as { ok?: unknown }).ok === true;
      } catch {
        return false;
      }
    },

    async readAppearance() {
      return parseAppearance(
        await evaluateHostScript("NYAWORKS.getTextEditorAppearance()", environment)
      );
    }
  };
}

export const textEditorAppearanceBridge = createTextEditorAppearanceBridge();
