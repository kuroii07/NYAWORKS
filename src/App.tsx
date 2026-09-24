import { useState } from "react";
import { PRODUCT_VERSION } from "./about/productInfo";
import { GlobalTooltip } from "./components/GlobalTooltip";
import { AppDialog } from "./components/AppDialog";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { HomePage } from "./pages/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useSettings } from "./settings/SettingsProvider";
import { useLanguage } from "./i18n/LanguageProvider";
import {
  resolveStartupPage,
  writeStoredLastPage
} from "./settings/lastPageStorage";
import type { SettingsTabId } from "./settings/types";
import type { PageId } from "./types/navigation";
import { CURRENT_RELEASE_NOTES } from "./updates/releaseNotes";
import { useUpdates } from "./updates/UpdatesProvider";

export default function App() {
  const { copy, languageId } = useLanguage();
  const { generalSettings } = useSettings();
  const {
    isWhatsNewOpen,
    isUpdateOpen,
    availableUpdate,
    closeDialog,
    openUpdatePage
  } = useUpdates();
  const releaseNotes = CURRENT_RELEASE_NOTES[languageId];
  const [activePage, setActivePage] = useState<PageId>(() =>
    resolveStartupPage(
      generalSettings.rememberLastPage,
      generalSettings.startupPage,
      typeof window === "undefined" ? undefined : window.localStorage
    )
  );
  const [settingsEntry, setSettingsEntry] = useState<{
    tab: SettingsTabId;
    editHome: boolean;
  }>({
    tab: "general",
    editHome: false
  });

  function handlePageChange(pageId: PageId) {
    setActivePage(pageId);
    writeStoredLastPage(
      pageId,
      typeof window === "undefined" ? undefined : window.localStorage
    );
  }

  function handleResetComplete() {
    setActivePage("home");
  }

  function openSettings(tab: SettingsTabId, editHome = false) {
    setSettingsEntry({ tab, editHome });
    handlePageChange("settings");
  }

  return (
    <div className="app-shell">
      <TopBar
        isSettingsActive={activePage === "settings"}
        onOpenSettings={() => openSettings("general")}
      />
      <div className="app-body">
        <Sidebar activePage={activePage} onPageChange={handlePageChange} />
        {activePage === "home" ? (
          <HomePage onEditLayout={() => openSettings("home", true)} />
        ) : activePage === "settings" ? (
          <SettingsPage
            key={`${settingsEntry.tab}-${settingsEntry.editHome}`}
            onResetComplete={handleResetComplete}
            initialTab={settingsEntry.tab}
            editHomeOnOpen={settingsEntry.editHome}
          />
        ) : (
          <PlaceholderPage pageId={activePage} />
        )}
      </div>
      <GlobalTooltip />
      {isWhatsNewOpen ? (
        <AppDialog
          title={copy.whatsNew.title}
          description={`${copy.whatsNew.version} ${releaseNotes.version} · ${copy.whatsNew.releaseDate} ${releaseNotes.releaseDate}`}
          primaryAction={{
            label: copy.whatsNew.close,
            onClick: closeDialog
          }}
          onClose={closeDialog}
        >
          <div className="whats-new-dialog">
            {(
              [
                ["features", copy.whatsNew.features],
                ["improvements", copy.whatsNew.improvements],
                ["fixes", copy.whatsNew.fixes]
              ] as const
            ).map(([sectionId, sectionLabel]) =>
              releaseNotes.sections[sectionId].length > 0 ? (
                <section key={sectionId}>
                  <h3>{sectionLabel}</h3>
                  <ul>
                    {releaseNotes.sections[sectionId].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null
            )}
          </div>
        </AppDialog>
      ) : null}
      {isUpdateOpen && availableUpdate ? (
        <AppDialog
          title={copy.updateDialog.title}
          description={`${copy.updateDialog.currentVersion} ${PRODUCT_VERSION} · ${copy.updateDialog.availableVersion} ${availableUpdate.tagName}`}
          primaryAction={{
            label: copy.updateDialog.update,
            onClick: openUpdatePage
          }}
          secondaryAction={{
            label: copy.updateDialog.notNow,
            onClick: closeDialog
          }}
          onClose={closeDialog}
        >
          <div className="update-dialog-summary">
            <strong>{availableUpdate.title}</strong>
            <p>
              {availableUpdate.body.trim() || copy.updateDialog.summaryFallback}
            </p>
          </div>
        </AppDialog>
      ) : null}
    </div>
  );
}
