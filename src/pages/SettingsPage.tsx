import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  ArrowsClockwise,
  Check,
  CursorClick,
  Eye,
  FolderOpen,
  GearSix,
  House,
  Info,
  RocketLaunch,
  Sparkle
} from "@phosphor-icons/react";
import { useState } from "react";
import { AppDialog } from "../components/AppDialog";
import { BrightnessControl } from "../components/BrightnessControl";
import {
  SettingSelect,
  type SettingSelectOption
} from "../components/SettingSelect";
import { useDensity } from "../density/DensityProvider";
import { DENSITY_IDS, type DensityId } from "../density/types";
import { useLanguage } from "../i18n/LanguageProvider";
import { LANGUAGES } from "../i18n/languages";
import { useSettings } from "../settings/SettingsProvider";
import { clearStoredLastPage } from "../settings/lastPageStorage";
import {
  SETTINGS_TAB_IDS,
  MAX_INTERFACE_BRIGHTNESS,
  MIN_INTERFACE_BRIGHTNESS,
  TOOLTIP_DELAY_OPTIONS,
  type MotionPreference,
  type SettingsTabId,
  type TooltipDelayMs
} from "../settings/types";
import { useTheme } from "../theme/ThemeProvider";
import { THEMES } from "../theme/themes";
import {
  STARTUP_PAGE_IDS,
  type StartupPageId
} from "../types/navigation";
import { AboutSettingsPanel } from "./AboutSettingsPanel";
import { HomeSettingsPanel } from "./HomeSettingsPanel";

type SettingIcon = ComponentType<IconProps>;

const settingsBannerUrl = new URL(
  "../assets/nyaworks-home-banner.png",
  import.meta.url
).href;

const TAB_ICONS: Record<SettingsTabId, SettingIcon> = {
  general: GearSix,
  home: House,
  ai: Sparkle,
  resources: FolderOpen,
  about: Info
};

const PLACEHOLDER_ICONS: Record<
  Exclude<SettingsTabId, "general" | "home" | "about">,
  SettingIcon
> = {
  ai: Sparkle,
  resources: FolderOpen
};

function SettingsSection({
  icon: Icon,
  title,
  tone = "default",
  children
}: {
  icon: SettingIcon;
  title: string;
  tone?: "default" | "highlight";
  children: ReactNode;
}) {
  return (
    <section className="settings-section" data-tone={tone}>
      <h2>
        <Icon aria-hidden="true" weight="regular" />
        <span>{title}</span>
      </h2>
      <div className="settings-section__rows">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <span className="setting-row__label">{label}</span>
      <div className="setting-row__control">{children}</div>
    </div>
  );
}

function SwitchControl({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="setting-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function GeneralSettingsPanel({
  onResetComplete
}: {
  onResetComplete: () => void;
}) {
  const { copy, languageId, setLanguage, resetLanguage } = useLanguage();
  const { densityId, setDensity, resetDensity } = useDensity();
  const {
    generalSettings,
    updateGeneralSettings,
    resetGeneralSettings,
    resetHomeSettings
  } = useSettings();
  const { themeId, setTheme, resetTheme } = useTheme();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const labels = copy.settings.general;
  const startupPageOptions: readonly SettingSelectOption<StartupPageId>[] =
    STARTUP_PAGE_IDS.map((pageId) => ({
      value: pageId,
      label: copy.navigation[pageId]
    }));
  const tooltipDelayOptions: readonly SettingSelectOption<TooltipDelayMs>[] =
    TOOLTIP_DELAY_OPTIONS.map((delay) => ({
      value: delay,
      label: `${delay} ms`
    }));
  const languageOptions: readonly SettingSelectOption<
    (typeof LANGUAGES)[number]["id"]
  >[] = LANGUAGES.map((language) => ({
    value: language.id,
    label: language.nativeName
  }));

  return (
    <div className="settings-general">
      <div className="settings-general__columns">
        <SettingsSection icon={RocketLaunch} title={labels.generalSection}>
          <SettingRow label={labels.startupPage}>
            <SettingSelect
              value={generalSettings.startupPage}
              disabled={generalSettings.rememberLastPage}
              ariaLabel={labels.startupPage}
              title={
                generalSettings.rememberLastPage
                  ? labels.rememberLastPage
                  : labels.startupPage
              }
              options={startupPageOptions}
              onChange={(startupPage) =>
                updateGeneralSettings({
                  startupPage
                })
              }
            />
          </SettingRow>
          <SettingRow label={labels.rememberLastPage}>
            <SwitchControl
              checked={generalSettings.rememberLastPage}
              label={labels.rememberLastPage}
              onChange={(rememberLastPage) =>
                updateGeneralSettings({ rememberLastPage })
              }
            />
          </SettingRow>
          <SettingRow label={labels.autoCheckUpdates}>
            <SwitchControl
              checked={generalSettings.autoCheckUpdates}
              label={labels.autoCheckUpdates}
              onChange={(autoCheckUpdates) =>
                updateGeneralSettings({ autoCheckUpdates })
              }
            />
          </SettingRow>
          <SettingRow label={labels.density}>
            <div className="setting-segments" data-count="3">
              {DENSITY_IDS.map((option) => (
                <button
                  type="button"
                  key={option}
                  data-active={densityId === option || undefined}
                  aria-pressed={densityId === option}
                  onClick={() => setDensity(option as DensityId)}
                >
                  {labels.densityOptions[option]}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label={labels.resetAllSettings}>
            <button
              className="setting-reset-button"
              type="button"
              onClick={() => setIsResetDialogOpen(true)}
            >
              <ArrowsClockwise aria-hidden="true" weight="bold" />
              {labels.resetAction}
            </button>
          </SettingRow>
        </SettingsSection>

        <SettingsSection icon={CursorClick} title={labels.interactionSection}>
          <SettingRow label={labels.tooltips}>
            <SwitchControl
              checked={generalSettings.tooltipsEnabled}
              label={labels.tooltips}
              onChange={(tooltipsEnabled) =>
                updateGeneralSettings({ tooltipsEnabled })
              }
            />
          </SettingRow>
          <SettingRow label={labels.tooltipDelay}>
            <SettingSelect
              value={generalSettings.tooltipDelayMs}
              disabled={!generalSettings.tooltipsEnabled}
              ariaLabel={labels.tooltipDelay}
              options={tooltipDelayOptions}
              onChange={(tooltipDelayMs) =>
                updateGeneralSettings({
                  tooltipDelayMs
                })
              }
            />
          </SettingRow>
          <SettingRow label={labels.motion}>
            <div className="setting-segments" data-count="3">
              {(["standard", "reduced", "off"] as const).map((option) => (
                <button
                  type="button"
                  key={option}
                  data-active={
                    generalSettings.motionPreference === option || undefined
                  }
                  aria-pressed={generalSettings.motionPreference === option}
                  onClick={() =>
                    updateGeneralSettings({
                      motionPreference: option as MotionPreference
                    })
                  }
                >
                  {labels.motionOptions[option]}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label={labels.showWhatsNew}>
            <SwitchControl
              checked={generalSettings.showWhatsNew}
              label={labels.showWhatsNew}
              onChange={(showWhatsNew) =>
                updateGeneralSettings({ showWhatsNew })
              }
            />
          </SettingRow>
          <SettingRow label={labels.confirmDangerousActions}>
            <SwitchControl
              checked={generalSettings.confirmDangerousActions}
              label={labels.confirmDangerousActions}
              onChange={(confirmDangerousActions) =>
                updateGeneralSettings({ confirmDangerousActions })
              }
            />
          </SettingRow>
        </SettingsSection>
      </div>

      <SettingsSection icon={Eye} title={labels.appearanceSection}>
        <div className="theme-preview-grid" aria-label={labels.currentTheme}>
          {THEMES.map((theme) => {
            const themeLabel =
              languageId === "zh-CN" || languageId === "zh-TW"
                ? theme.name
                : theme.englishName;

            return (
              <button
                className="theme-preview-card"
                type="button"
                key={theme.id}
                data-active={themeId === theme.id || undefined}
                aria-label={themeLabel}
                aria-pressed={themeId === theme.id}
                title={themeLabel}
                onClick={() => setTheme(theme.id)}
              >
                <span
                  className="theme-preview-card__art"
                  style={{
                    background: `linear-gradient(112deg, ${theme.swatches[0]} 4%, ${theme.swatches[0]} 40%, ${theme.swatches[1]} 145%)`
                  }}
                >
                  <i style={{ background: theme.swatches[1] }} />
                  <i style={{ background: theme.swatches[2] }} />
                </span>
                <span className="theme-preview-card__name">{themeLabel}</span>
              </button>
            );
          })}
        </div>
        <div className="appearance-options">
          <SettingRow label={labels.currentLanguage}>
            <SettingSelect
              className="setting-select--wide"
              value={languageId}
              ariaLabel={labels.currentLanguage}
              options={languageOptions}
              onChange={setLanguage}
            />
          </SettingRow>
          <SettingRow label={labels.interfaceBrightness}>
            <BrightnessControl
              value={generalSettings.interfaceBrightness}
              min={MIN_INTERFACE_BRIGHTNESS}
              max={MAX_INTERFACE_BRIGHTNESS}
              ariaLabel={labels.interfaceBrightness}
              onChange={(interfaceBrightness) =>
                updateGeneralSettings({ interfaceBrightness })
              }
            />
          </SettingRow>
          <SettingRow label={labels.homeBanner}>
            <SwitchControl
              checked={generalSettings.homeBannerEnabled}
              label={labels.homeBanner}
              onChange={(homeBannerEnabled) =>
                updateGeneralSettings({ homeBannerEnabled })
              }
            />
          </SettingRow>
        </div>
      </SettingsSection>

      <section className="settings-brand-banner" aria-label="NYAWORKS">
        <img src={settingsBannerUrl} alt="" />
        <div className="settings-brand-banner__copy">
          <small>MAKE IDEAS MOVE.</small>
          <strong>NYAWORKS</strong>
          <span>FOR AFTER EFFECTS</span>
        </div>
      </section>

      <p className="settings-save-note">
        <Check aria-hidden="true" weight="bold" />
        {labels.autoSaveNote}
      </p>

      {isResetDialogOpen ? (
        <AppDialog
          title={labels.resetDialogTitle}
          description={labels.resetDialogBody}
          primaryAction={{
            label: labels.resetConfirm,
            onClick: () => {
              resetGeneralSettings();
              resetHomeSettings();
              resetTheme();
              resetLanguage();
              resetDensity();
              clearStoredLastPage(
                typeof window === "undefined"
                  ? undefined
                  : window.localStorage
              );
              setIsResetDialogOpen(false);
              onResetComplete();
            }
          }}
          secondaryAction={{
            label: labels.resetCancel,
            onClick: () => setIsResetDialogOpen(false)
          }}
          onClose={() => setIsResetDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SettingsPlaceholder({
  tabId
}: {
  tabId: Exclude<SettingsTabId, "general" | "home" | "about">;
}) {
  const { copy } = useLanguage();
  const Icon = PLACEHOLDER_ICONS[tabId];

  return (
    <section className="settings-placeholder">
      <div className="settings-placeholder__icon" aria-hidden="true">
        <Icon weight="regular" />
      </div>
      <strong>{copy.settings.tabs[tabId]}</strong>
      <span>{copy.settings.comingSoon.heading}</span>
      <small>{copy.settings.comingSoon.body}</small>
    </section>
  );
}

export function SettingsPage({
  onResetComplete,
  initialTab = "general",
  editHomeOnOpen = false
}: {
  onResetComplete: () => void;
  initialTab?: SettingsTabId;
  editHomeOnOpen?: boolean;
}) {
  const { copy } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  return (
    <main className="settings-workspace">
      <nav
        className="settings-tabs"
        aria-label={copy.settings.navigationAria}
      >
        {SETTINGS_TAB_IDS.map((tabId) => {
          const Icon = TAB_ICONS[tabId];
          const isActive = tabId === activeTab;
          const label = copy.settings.tabs[tabId];

          return (
            <button
              type="button"
              key={tabId}
              data-active={isActive || undefined}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              title={label}
              onClick={() => setActiveTab(tabId)}
            >
              <Icon aria-hidden="true" weight="regular" />
            </button>
          );
        })}
      </nav>

      <div className="settings-content">
        {activeTab === "general" ? (
          <GeneralSettingsPanel onResetComplete={onResetComplete} />
        ) : activeTab === "home" ? (
          <HomeSettingsPanel initialEditing={editHomeOnOpen} />
        ) : activeTab === "about" ? (
          <AboutSettingsPanel />
        ) : (
          <SettingsPlaceholder tabId={activeTab} />
        )}
      </div>
    </main>
  );
}
