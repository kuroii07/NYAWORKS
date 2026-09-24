import {
  PAGE_IDS,
  type PageId,
  type StartupPageId
} from "../types/navigation";

export const LAST_PAGE_STORAGE_KEY = "nyaworks.navigation.lastPage.v1";

interface PageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isPageId(value: unknown): value is PageId {
  return typeof value === "string" && PAGE_IDS.includes(value as PageId);
}

export function readStoredLastPage(storage?: PageStorage): PageId {
  if (!storage) {
    return "home";
  }

  try {
    const storedValue = storage.getItem(LAST_PAGE_STORAGE_KEY);
    return isPageId(storedValue) ? storedValue : "home";
  } catch {
    return "home";
  }
}

export function writeStoredLastPage(
  pageId: PageId,
  storage?: PageStorage
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LAST_PAGE_STORAGE_KEY, pageId);
  } catch {
    // CEP can run with storage disabled. Keep navigation available.
  }
}

export function resolveStartupPage(
  rememberLastPage: boolean,
  startupPage: StartupPageId,
  storage?: PageStorage
): PageId {
  return rememberLastPage ? readStoredLastPage(storage) : startupPage;
}
