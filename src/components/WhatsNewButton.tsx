import { BellRinging } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import { useSettings } from "../settings/SettingsProvider";
import { useUpdates } from "../updates/UpdatesProvider";

export function WhatsNewButton() {
  const { copy } = useLanguage();
  const { generalSettings } = useSettings();
  const { hasUnreadNotes, openWhatsNew } = useUpdates();
  const showUnreadBadge = generalSettings.showWhatsNew && hasUnreadNotes;

  return (
    <button
      className="icon-button whats-new-button"
      type="button"
      aria-label={copy.topbar.whatsNewAria}
      title={copy.topbar.whatsNewTitle}
      onClick={openWhatsNew}
    >
      <BellRinging aria-hidden="true" weight="regular" />
      {showUnreadBadge ? (
        <span className="whats-new-button__badge" aria-hidden="true" />
      ) : null}
    </button>
  );
}
