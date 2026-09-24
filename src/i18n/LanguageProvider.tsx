import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import {
  DEFAULT_LANGUAGE_ID,
  type LanguageId
} from "./languages";
import { readStoredLanguage, writeStoredLanguage } from "./languageStorage";
import { UI_COPY } from "./translations";
import type { UiCopy } from "./types";

interface LanguageContextValue {
  languageId: LanguageId;
  copy: UiCopy;
  setLanguage: (languageId: LanguageId) => void;
  resetLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): LanguageId {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE_ID;
  }

  return readStoredLanguage(window.localStorage);
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [languageId, setLanguageId] = useState<LanguageId>(getInitialLanguage);

  useLayoutEffect(() => {
    document.documentElement.lang = languageId;
    document.documentElement.dataset.language = languageId;
    writeStoredLanguage(languageId, window.localStorage);
  }, [languageId]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      languageId,
      copy: UI_COPY[languageId],
      setLanguage: setLanguageId,
      resetLanguage: () => setLanguageId(DEFAULT_LANGUAGE_ID)
    }),
    [languageId]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}
