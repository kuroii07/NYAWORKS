import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { DEFAULT_THEME_ID, THEMES_BY_ID } from "./themes";
import { readStoredTheme, writeStoredTheme } from "./themeStorage";
import type { ThemeDefinition, ThemeId } from "./types";

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeDefinition;
  setTheme: (themeId: ThemeId) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_ID;
  }

  return readStoredTheme(window.localStorage);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeId, setThemeId] = useState<ThemeId>(getInitialTheme);
  const theme = THEMES_BY_ID[themeId];

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.dataset.theme = themeId;
    root.style.colorScheme = "dark";

    for (const [token, value] of Object.entries(theme.tokens)) {
      root.style.setProperty(token, value);
    }

    const metaThemeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    metaThemeColor?.setAttribute("content", theme.tokens["--nw-bg"]);

    writeStoredTheme(themeId, window.localStorage);
  }, [theme, themeId]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme,
      setTheme: setThemeId,
      resetTheme: () => setThemeId(DEFAULT_THEME_ID)
    }),
    [theme, themeId]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}

