import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Check, CaretDown, MagicWand, SlidersHorizontal, Sparkle } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import { HOME_TOOL_CATALOG } from "../homeLayouts/catalog";
import type { ToolId } from "../i18n/types";

const BANNER_TOOL_IDS = ["adjust", "effects", "quickPreset"] as const satisfies readonly ToolId[];
type BannerToolId = (typeof BANNER_TOOL_IDS)[number];

const BANNER_TOOL_ICONS = {
  adjust: SlidersHorizontal,
  effects: MagicWand,
  quickPreset: Sparkle
} as const;

interface BannerWorkspaceProps {
  toolId?: BannerToolId | null;
  onToolChange?: (toolId: BannerToolId | null) => void;
}

export function BannerWorkspace({ toolId, onToolChange }: BannerWorkspaceProps) {
  const { copy } = useLanguage();
  const home = copy.home;
  const [internalToolId, setInternalToolId] = useState<BannerToolId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 16, top: 16 });
  const shellRef = useRef<HTMLDivElement>(null);
  const activeToolId = toolId === undefined ? internalToolId : toolId;

  function changeTool(nextToolId: BannerToolId | null) {
    if (toolId === undefined) setInternalToolId(nextToolId);
    onToolChange?.(nextToolId);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;

    function closeMenu(event: MouseEvent) {
      if (!shellRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function openMenu(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 190;
    const height = 180;
    setMenuPosition({
      left: Math.max(8, Math.min(event.clientX - rect.left, rect.width - width - 8)),
      top: Math.max(8, Math.min(event.clientY - rect.top, rect.height - height - 8))
    });
    setMenuOpen(true);
  }

  const activeTool = activeToolId ? HOME_TOOL_CATALOG[activeToolId] : null;
  const ActiveIcon = activeToolId ? BANNER_TOOL_ICONS[activeToolId] : null;

  return (
    <div className="banner-workspace-shell" ref={shellRef}>
      {activeToolId && activeTool && ActiveIcon ? (
        <section
          className="banner-tool-workspace"
          aria-label={home.toolLabels[activeToolId]}
          onContextMenu={openMenu}
        >
          <div className="banner-tool-workspace__art" aria-hidden="true">
            <ActiveIcon weight="regular" />
          </div>
          <div className="banner-tool-workspace__copy">
            <span className="banner-tool-workspace__eyebrow">{home.bannerToolEyebrow}</span>
            <h1 className="banner-tool-workspace__title">{home.toolLabels[activeToolId]}</h1>
            <p>{home.bannerSubtitle}</p>
          </div>
          <button
            className="banner-tool-workspace__reset"
            type="button"
            data-banner-reset="true"
            aria-label={home.bannerReset}
            title={home.bannerReset}
            onClick={() => changeTool(null)}
          >
            <CaretDown aria-hidden="true" />
          </button>
        </section>
      ) : (
        <section className="home-banner" aria-label="NYAWORKS" onContextMenu={openMenu}>
          <div className="home-banner__copy">
            <h1>
              {home.bannerLead}
              <span>{home.bannerAccent}</span>
            </h1>
            <p>{home.bannerSubtitle}</p>
          </div>
        </section>
      )}

      {menuOpen ? (
        <div
          className="banner-tool-menu"
          role="menu"
          aria-label={home.bannerLead}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <button
            className="banner-tool-menu__item"
            type="button"
            role="menuitemradio"
            aria-checked={activeToolId === null}
            data-banner-tool-id="default"
            onClick={() => changeTool(null)}
          >
            <span>{home.bannerLead}</span>
            {activeToolId === null ? <Check aria-hidden="true" /> : null}
          </button>
          {BANNER_TOOL_IDS.map((id) => {
            const Icon = BANNER_TOOL_ICONS[id];
            return (
              <button
                className="banner-tool-menu__item"
                type="button"
                role="menuitemradio"
                aria-checked={activeToolId === id}
                data-banner-tool-id={id}
                key={id}
                onClick={() => changeTool(id)}
              >
                <span className="banner-tool-menu__icon"><Icon aria-hidden="true" /></span>
                <span>{home.toolLabels[id]}</span>
                {activeToolId === id ? <Check aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export type { BannerToolId };
