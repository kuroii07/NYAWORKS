import { useEffect, useMemo, useRef, useState } from "react";
import {
  BracketsCurly,
  FileCode,
  MagicWand,
  MagnifyingGlass,
  SlidersHorizontal,
  Wrench
} from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import { HOME_TOOL_CATALOG } from "../homeLayouts/catalog";
import { groupGlobalSearchItems } from "../search/searchOperations";
import { useOptionalGlobalSearch } from "../search/GlobalSearchProvider";
import type { GlobalSearchItem } from "../search/types";

function SearchItemIcon({ item }: { item: GlobalSearchItem }) {
  const ToolIcon = item.toolId ? HOME_TOOL_CATALOG[item.toolId]?.icon : undefined;
  if (ToolIcon) return <ToolIcon aria-hidden="true" weight="regular" />;
  if (item.kind === "effect") return <MagicWand aria-hidden="true" weight="regular" />;
  if (item.kind === "preset") return <SlidersHorizontal aria-hidden="true" weight="regular" />;
  if (item.kind === "expression") return <BracketsCurly aria-hidden="true" weight="regular" />;
  if (item.kind === "script") return <FileCode aria-hidden="true" weight="regular" />;
  return <Wrench aria-hidden="true" weight="regular" />;
}

export function GlobalSearchPanel({ onExecute }: { onExecute?: (item: GlobalSearchItem) => void }) {
  const { copy } = useLanguage();
  const globalSearch = useOptionalGlobalSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const executionRef = useRef(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const home = copy.home;
  const results = useMemo(() => globalSearch?.search(query) ?? [], [globalSearch, query]);
  const groups = useMemo(() => groupGlobalSearchItems(results), [results]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
    document.addEventListener("keydown", handleGlobalShortcut);
    return () => document.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  async function execute(item: GlobalSearchItem | undefined) {
    if (!item || executionRef.current) return;
    executionRef.current = true;
    try {
      if (globalSearch) await globalSearch.executeItem(item);
      onExecute?.(item);
      setOpen(false);
    } finally {
      window.setTimeout(() => { executionRef.current = false; }, 120);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setSelectedIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      void execute(results[selectedIndex]);
    }
  }

  return (
    <div className="global-search-shell">
      <label className="global-search">
        <MagnifyingGlass aria-hidden="true" weight="regular" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={home.searchPlaceholder}
          aria-label={home.searchAria}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="search-key">⌘</span>
        <span className="search-key">K</span>
      </label>
      {open ? (
        <div className="global-search-results" role="listbox" aria-label={home.searchAria}>
          {results.length === 0 ? (
            <div className="global-search-empty">{query.trim() ? home.searchNoResults : home.searchEmpty}</div>
          ) : (
            [...groups.entries()].map(([kind, items]) => items.length > 0 ? (
              <section className="global-search-group" key={kind}>
                <h3>{home.searchKindLabels[kind]}</h3>
                {items.map((item) => {
                  const index = results.indexOf(item);
                  return (
                    <button
                      className="global-search-result-row"
                      data-selected={index === selectedIndex || undefined}
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => void execute(item)}
                    >
                      <span className="global-search-result-row__icon"><SearchItemIcon item={item} /></span>
                      <span>{item.displayName ?? item.name}</span>
                    </button>
                  );
                })}
              </section>
            ) : null)
          )}
        </div>
      ) : null}
    </div>
  );
}
