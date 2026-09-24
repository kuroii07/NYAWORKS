import { Hammer } from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import { useTheme } from "../theme/ThemeProvider";
import type { PageId } from "../types/navigation";

export function PlaceholderPage({ pageId }: { pageId: PageId }) {
  const { copy } = useLanguage();
  const { theme } = useTheme();
  const pageTitle =
    pageId === "home" ? copy.navigation.home : copy.placeholder[pageId];

  return (
    <main className="placeholder-workspace">
      <section className="placeholder-stage" aria-labelledby="stage-title">
        <div className="placeholder-stage__icon" aria-hidden="true">
          <Hammer weight="regular" />
        </div>
        <p>{pageTitle}</p>
        <h1 id="stage-title">{copy.placeholder.heading}</h1>
        <span>{copy.placeholder.body}</span>
        <small>
          {copy.placeholder.currentTheme}：{theme.name} · {theme.englishName}
        </small>
      </section>
    </main>
  );
}
