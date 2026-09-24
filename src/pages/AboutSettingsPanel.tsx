import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  BookOpenText,
  Bug,
  Database,
  DownloadSimple,
  FolderOpen,
  GithubLogo,
  GlobeHemisphereWest,
  Heart,
  Key,
  PlayCircle,
  ShieldCheck,
  ShoppingCartSimple
} from "@phosphor-icons/react";
import {
  createDiagnosticsReport,
  downloadDiagnosticsReport
} from "../about/diagnostics";
import {
  EXTENSION_ID,
  FEISHU_DOCUMENTATION_URL,
  FEISHU_FEEDBACK_URL,
  GITHUB_REPOSITORY_URL,
  isSafeExternalUrl,
  openExternalUrl,
  PRODUCT_VERSION
} from "../about/productInfo";
import { BrandMark } from "../components/BrandMark";
import { useDensity } from "../density/DensityProvider";
import {
  openHostDataDirectory,
  readAfterEffectsHostInfo,
  UNAVAILABLE_HOST_INFO
} from "../host/cepBridge";
import { useLanguage } from "../i18n/LanguageProvider";
import { LANGUAGES } from "../i18n/languages";
import {
  createUnconfiguredLicenseService,
  UNCONFIGURED_LICENSE_SNAPSHOT
} from "../licensing/licenseService";
import { useTheme } from "../theme/ThemeProvider";

type AboutIcon = ComponentType<IconProps>;

const settingsBannerUrl = new URL(
  "../assets/nyaworks-home-banner.png",
  import.meta.url
).href;
const licenseService = createUnconfiguredLicenseService();

function AboutActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  title,
  external = false
}: {
  icon: AboutIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  external?: boolean;
}) {
  return (
    <button
      className="about-action-button"
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <Icon aria-hidden="true" weight="regular" />
      <span>{label}</span>
      {external ? <ArrowSquareOut aria-hidden="true" weight="regular" /> : null}
    </button>
  );
}

export function AboutSettingsPanel() {
  const { copy, languageId } = useLanguage();
  const { densityId } = useDensity();
  const { themeId } = useTheme();
  const labels = copy.settings.about;
  const [hostInfo, setHostInfo] = useState(UNAVAILABLE_HOST_INFO);
  const [licenseSnapshot, setLicenseSnapshot] = useState(
    UNCONFIGURED_LICENSE_SNAPSHOT
  );
  const currentLanguage =
    LANGUAGES.find((language) => language.id === languageId)?.nativeName ??
    languageId;
  const hostVersion =
    hostInfo.status === "connected" && hostInfo.version
      ? `After Effects ${hostInfo.version}`
      : labels.hostDisconnected;
  const repositoryHref = isSafeExternalUrl(GITHUB_REPOSITORY_URL)
    ? GITHUB_REPOSITORY_URL
    : undefined;
  const documentationHref = isSafeExternalUrl(FEISHU_DOCUMENTATION_URL)
    ? FEISHU_DOCUMENTATION_URL
    : undefined;
  const feedbackHref = isSafeExternalUrl(FEISHU_FEEDBACK_URL)
    ? FEISHU_FEEDBACK_URL
    : undefined;

  useEffect(() => {
    let isMounted = true;

    readAfterEffectsHostInfo().then((nextHostInfo) => {
      if (isMounted) {
        setHostInfo(nextHostInfo);
      }
    });
    licenseService.getSnapshot().then((nextLicenseSnapshot) => {
      if (isMounted) {
        setLicenseSnapshot(nextLicenseSnapshot);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  function openUrl(url: string) {
    openExternalUrl(url);
  }

  function exportDiagnostics() {
    downloadDiagnosticsReport(
      createDiagnosticsReport({
        productVersion: PRODUCT_VERSION,
        extensionId: EXTENSION_ID,
        languageId,
        themeId,
        densityId,
        hostInfo
      })
    );
  }

  return (
    <div className="settings-about">
      <section className="about-hero">
        <img className="about-hero__art" src={settingsBannerUrl} alt="" />
        <div className="about-hero__content">
          <BrandMark className="about-hero__logo" />
          <div className="about-hero__copy">
            <strong>
              <span>NYA</span>WORKS
            </strong>
            <small>FOR AFTER EFFECTS</small>
            <p>{labels.productTagline}</p>
          </div>
        </div>
      </section>

      <section className="about-summary" aria-label={labels.productSection}>
        <div className="about-summary__version">
          <span>{labels.version}</span>
          <strong>{PRODUCT_VERSION}</strong>
        </div>
        <div className="about-summary__host" data-status={hostInfo.status}>
          <span>{labels.currentAfterEffects}</span>
          <strong>{hostVersion}</strong>
        </div>
      </section>

      <section className="about-info-card about-license-panel">
        <h2>
          <Key aria-hidden="true" weight="regular" />
          <span>{labels.licensingSection}</span>
        </h2>
        <div className="about-license-layout">
          <div className="about-info-list about-license-overview">
            <div>
              <span>{labels.licenseStatus}</span>
              <strong className="about-status-badge" data-status={licenseSnapshot.status}>
                {labels.licenseNotConfigured}
              </strong>
            </div>
            <div>
              <span>{labels.licenseType}</span>
              <strong>{labels.licenseTypePending}</strong>
            </div>
            <div>
              <span>{labels.currentDevice}</span>
              <strong>{labels.deviceUnavailable}</strong>
            </div>
          </div>
          <div className="about-license-actions">
            <AboutActionButton
              icon={ShoppingCartSimple}
              label={labels.purchaseLicense}
              disabled
              title={labels.notConfiguredAction}
            />
            <AboutActionButton
              icon={Key}
              label={labels.activateLicense}
              disabled
              title={labels.notConfiguredAction}
            />
            <AboutActionButton
              icon={ShieldCheck}
              label={labels.manageDevices}
              disabled
              title={labels.notConfiguredAction}
            />
          </div>
        </div>
      </section>

      <section className="about-info-card about-update-strip">
        <div className="about-update-strip__heading">
          <ArrowsClockwise aria-hidden="true" weight="regular" />
          <span>{labels.updateSection}</span>
        </div>
        <div className="about-update-strip__copy">
          <strong className="about-info-card__lead">
            {labels.updateChannelValue}
          </strong>
          <small>
            {labels.automaticUpdates} · {labels.automaticUpdatesValue}
          </small>
        </div>
        <button
          className="about-link-button"
          type="button"
          disabled={!repositoryHref}
          onClick={() => openUrl(GITHUB_REPOSITORY_URL)}
        >
          <GithubLogo aria-hidden="true" weight="regular" />
          <span>{labels.openRepository}</span>
          <ArrowSquareOut aria-hidden="true" weight="regular" />
        </button>
      </section>

      <section className="about-info-card about-info-card--wide">
        <h2>
          <BookOpenText aria-hidden="true" weight="regular" />
          <span>{labels.helpSection}</span>
        </h2>
        <div className="about-action-grid">
          <AboutActionButton
            icon={BookOpenText}
            label={labels.documentation}
            external
            disabled={!documentationHref}
            title={!documentationHref ? labels.notConfiguredAction : undefined}
            onClick={() => openUrl(FEISHU_DOCUMENTATION_URL)}
          />
          <AboutActionButton
            icon={PlayCircle}
            label={labels.videoTutorials}
            disabled
            title={labels.notConfiguredAction}
          />
          <AboutActionButton
            icon={Bug}
            label={labels.feedback}
            external
            disabled={!feedbackHref}
            title={!feedbackHref ? labels.notConfiguredAction : undefined}
            onClick={() => openUrl(FEISHU_FEEDBACK_URL)}
          />
          <AboutActionButton
            icon={GlobeHemisphereWest}
            label={labels.officialWebsite}
            disabled
            title={labels.notConfiguredAction}
          />
        </div>
      </section>

      <section className="about-info-card about-info-card--wide">
        <h2>
          <Database aria-hidden="true" weight="regular" />
          <span>{labels.diagnosticsSection}</span>
        </h2>
        <div className="about-action-grid about-action-grid--diagnostics">
          <AboutActionButton
            icon={DownloadSimple}
            label={labels.exportDiagnostics}
            onClick={exportDiagnostics}
          />
          <AboutActionButton
            icon={FolderOpen}
            label={labels.openDataDirectory}
            disabled={hostInfo.status !== "connected"}
            title={
              hostInfo.status === "connected"
                ? labels.openDataDirectory
                : labels.hostOnlyAction
            }
            onClick={() => {
              void openHostDataDirectory();
            }}
          />
        </div>
        <div className="about-diagnostics-grid">
          <div>
            <span>{labels.extensionId}</span>
            <strong>{EXTENSION_ID}</strong>
          </div>
          <div>
            <span>{labels.supportedLanguages}</span>
            <strong>{currentLanguage}</strong>
          </div>
          <div>
            <span>{labels.localPreferences}</span>
            <strong>{labels.localPreferencesValue}</strong>
          </div>
          <div>
            <span>{labels.aiData}</span>
            <strong>{labels.aiDataValue}</strong>
          </div>
        </div>
        <div className="about-legal-links">
          {[labels.privacyPolicy, labels.openSourceLicenses, labels.userAgreement].map(
            (label) => (
              <button
                type="button"
                key={label}
                disabled
                title={labels.notConfiguredAction}
              >
                {label}
              </button>
            )
          )}
        </div>
      </section>

      <section className="about-thanks">
        <Heart aria-hidden="true" weight="regular" />
        <div>
          <strong>{labels.thanksSection}</strong>
          <p>{labels.thanksBody}</p>
        </div>
        <span className="about-thanks__signature" aria-label="Creative Together">
          Creative
          <br />
          Together.
        </span>
      </section>
    </div>
  );
}
