import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function renderResourceLayout() {
  const dom = new JSDOM(`<!doctype html>
    <style>${css}</style>
    <main class="resources-page">
      <header class="resources-page__header"></header>
      <div class="resource-browser">
        <aside class="resource-browser__navigation">
          <ul class="resource-folder-tree">
            <li><div><button class="resource-folder-tree__item">Scripts</button></div></li>
          </ul>
        </aside>
        <section class="resource-browser__content">
          <div class="resource-browser__filters"></div>
          <div class="resource-list"><article class="resource-list-row"></article></div>
        </section>
      </div>
    </main>`);

  const styleOf = (selector) => dom.window.getComputedStyle(dom.window.document.querySelector(selector));
  return {
    page: styleOf(".resources-page"),
    browser: styleOf(".resource-browser"),
    navigation: styleOf(".resource-browser__navigation"),
    content: styleOf(".resource-browser__content"),
    list: styleOf(".resource-list"),
    folderItem: styleOf(".resource-folder-tree__item")
  };
}

describe("resource browser accessibility styles", () => {
  it("keeps resource navigation adaptive and never autoplays preview media", () => {
    expect(css).toContain(".resources-page");
    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain(".resource-browser__navigation");
    expect(css).not.toMatch(/\.resource-preview-card video[^}]*autoplay/i);
  });

  it("keeps resource header and row actions horizontal in narrow panels", () => {
    expect(css).toMatch(/\.resources-page__header \{ align-items: center; flex-direction: row;/);
    expect(css).toMatch(/\.resource-list-row \{ align-items: center; flex-wrap: nowrap;/);
    expect(css).toMatch(/\.resource-list-row__actions \{ width: auto; flex: 0 0 auto;/);
  });

  it("keeps the folder tree compact", () => {
    const styles = renderResourceLayout();
    expect(styles.folderItem.fontSize).toBe("12px");
  });

  it("keeps navigation visible while the resource list owns vertical scrolling", () => {
    const styles = renderResourceLayout();

    expect(styles.page.display).toBe("flex");
    expect(styles.page.flexDirection).toBe("column");
    expect(styles.page.overflowY).toBe("hidden");
    expect(styles.browser.flexGrow).toBe("1");
    expect(styles.browser.minHeight).toBe("0");
    expect(styles.navigation.overflowY).toBe("auto");
    expect(styles.content.display).toBe("flex");
    expect(styles.content.flexDirection).toBe("column");
    expect(styles.content.minHeight).toBe("0");
    expect(styles.content.overflowY).toBe("hidden");
    expect(styles.list.flexGrow).toBe("1");
    expect(styles.list.overflowY).toBe("auto");
  });

  it("does not add a second outline when a resource row is selected", () => {
    expect(css).toMatch(
      /\.resource-list-row\[data-selected\]:focus-visible \{ outline: none; outline-offset: 0; \}/
    );
  });
});
