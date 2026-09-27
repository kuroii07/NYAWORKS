import { ArrowClockwise, GearSix } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import { isCepDevBuild, reloadCepPanel } from "../dev/cepDevTools";
import { BrandMark } from "./BrandMark";
import { LanguageMenu } from "./LanguageMenu";
import { ThemeMenu } from "./ThemeMenu";
import { WhatsNewButton } from "./WhatsNewButton";

interface TopBarProps {
  isSettingsActive: boolean;
  onOpenSettings: () => void;
}

export function TopBar({ isSettingsActive, onOpenSettings }: TopBarProps) {
  const { copy } = useLanguage();

  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="NYAWORKS FOR AFTER EFFECTS">
        <BrandMark className="brand-mark" />
        <div>
          <div className="brand-wordmark">
            <span>NYA</span>WORKS
          </div>
          <div className="brand-subtitle">FOR AFTER EFFECTS</div>
        </div>
      </div>

      <div className="topbar-actions">
        <WhatsNewButton />
        <ThemeMenu />
        <LanguageMenu />
        {isCepDevBuild && (
          <button
            className="icon-button"
            type="button"
            aria-label={copy.topbar.devReloadAria}
            title={copy.topbar.devReloadTitle}
            data-cep-dev-reload="true"
            onClick={() => reloadCepPanel()}
          >
            <ArrowClockwise aria-hidden="true" weight="regular" />
          </button>
        )}
        <button
          className="icon-button"
          type="button"
          aria-label={copy.topbar.settingsAria}
          aria-current={isSettingsActive ? "page" : undefined}
          data-active={isSettingsActive || undefined}
          title={copy.topbar.settingsTitle}
          onClick={onOpenSettings}
        >
          <GearSix aria-hidden="true" weight="regular" />
        </button>
      </div>
    </header>
  );
}
