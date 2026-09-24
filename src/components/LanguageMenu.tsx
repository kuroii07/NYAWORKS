import { useEffect, useId, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  getLanguageButtonLabel,
  getNextLanguageId,
  LANGUAGES
} from "../i18n/languages";

export function LanguageMenu() {
  const { languageId, copy, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [primaryMark, secondaryMark] = getLanguageButtonLabel(languageId);
  const hasSecondaryMark = secondaryMark !== undefined;

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
    <div className="language-menu" ref={containerRef}>
      <button
        className="icon-button language-button"
        type="button"
        aria-label={copy.topbar.languageAria}
        aria-expanded={isOpen}
        aria-controls={menuId}
        title={copy.topbar.languageTitle}
        onClick={() => {
          setLanguage(getNextLanguageId(languageId));
          setIsOpen(false);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setIsOpen((open) => !open);
        }}
      >
        <span
          className={`language-mark${
            hasSecondaryMark ? "" : " language-mark--single"
          }`}
          aria-hidden="true"
        >
          <span>{primaryMark}</span>
          {hasSecondaryMark ? (
            <>
              <i>/</i>
              <span>{secondaryMark}</span>
            </>
          ) : null}
        </span>
      </button>

      {isOpen ? (
        <div className="language-popover" id={menuId} role="menu">
          <div className="language-popover__header">
            <span>{copy.languageMenu.heading}</span>
            <span>5 LANGUAGES</span>
          </div>

          <div className="language-options">
            {LANGUAGES.map((language) => {
              const isSelected = language.id === languageId;

              return (
                <button
                  className="language-option"
                  data-selected={isSelected}
                  key={language.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setLanguage(language.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="language-option__mark" aria-hidden="true">
                    {language.mark}
                  </span>
                  <span className="language-option__copy">
                    <strong>{language.nativeName}</strong>
                    <small>{language.englishName}</small>
                  </span>
                  <span className="language-option__check" aria-hidden="true">
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
