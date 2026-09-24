import { useState } from "react";
import { GlobalTooltip } from "./components/GlobalTooltip";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { HomePage } from "./pages/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useSettings } from "./settings/SettingsProvider";
import {
  resolveStartupPage,
  writeStoredLastPage
} from "./settings/lastPageStorage";
import type { PageId } from "./types/navigation";

export default function App() {
  const { generalSettings } = useSettings();
  const [activePage, setActivePage] = useState<PageId>(() =>
    resolveStartupPage(
      generalSettings.rememberLastPage,
      generalSettings.startupPage,
      typeof window === "undefined" ? undefined : window.localStorage
    )
  );

  function handlePageChange(pageId: PageId) {
    setActivePage(pageId);
    writeStoredLastPage(
      pageId,
      typeof window === "undefined" ? undefined : window.localStorage
    );
  }

  return (
    <div className="app-shell">
      <TopBar
        isSettingsActive={activePage === "settings"}
        onOpenSettings={() => handlePageChange("settings")}
      />
      <div className="app-body">
        <Sidebar activePage={activePage} onPageChange={handlePageChange} />
        {activePage === "home" ? (
          <HomePage />
        ) : activePage === "settings" ? (
          <SettingsPage />
        ) : (
          <PlaceholderPage pageId={activePage} />
        )}
      </div>
      <GlobalTooltip />
    </div>
  );
}
