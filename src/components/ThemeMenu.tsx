import { useEffect, useId, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import { useTheme } from "../theme/ThemeProvider";
import { getNextThemeId, THEMES } from "../theme/themes";

function ThemeTilesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.55"
    >
      <rect x="3.5" y="3.5" width="6.75" height="6.75" rx="1.9" />
      <rect x="13.75" y="3.5" width="6.75" height="6.75" rx="1.9" />
      <rect x="3.5" y="13.75" width="6.75" height="6.75" rx="1.9" />
      <rect x="13.75" y="13.75" width="6.75" height="6.75" rx="1.9" />
    </svg>
  );
}

export function ThemeMenu() {
  const { copy } = useLanguage();
  const { themeId, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="theme-menu" ref={containerRef}>
      <button
        className="icon-button"
        type="button"
        aria-label={copy.topbar.themeAria}
        aria-expanded={isOpen}
        aria-controls={menuId}
        title={copy.topbar.themeTitle}
        onClick={() => {
          setTheme(getNextThemeId(themeId));
          setIsOpen(false);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setIsOpen((open) => !open);
        }}
      >
        <ThemeTilesIcon />
      </button>

      {isOpen ? (
        <div className="theme-popover" id={menuId} role="menu">
          <div className="theme-popover__header">
            <span>{copy.topbar.themeHeading}</span>
            <span>5 DARK THEMES</span>
          </div>

          <div className="theme-options">
            {THEMES.map((theme) => {
              const isSelected = theme.id === themeId;

              return (
                <button
                  className="theme-option"
                  data-selected={isSelected}
                  key={theme.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setTheme(theme.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="theme-option__swatches" aria-hidden="true">
                    {theme.swatches.map((color) => (
                      <span key={color} style={{ backgroundColor: color }} />
                    ))}
                  </span>

                  <span className="theme-option__copy">
                    <strong>{theme.name}</strong>
                    <small>{theme.englishName}</small>
                  </span>

                  <span className="theme-option__check" aria-hidden="true">
                    {isSelected ? <Check weight="bold" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
