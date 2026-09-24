import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { PRODUCT_VERSION } from "../about/productInfo";
import { openExternalUrl } from "../about/productInfo";
import { useSettings } from "../settings/SettingsProvider";
import { fetchLatestRelease } from "./githubReleaseService";
import {
  hasUnreadReleaseNotes,
  readLastSeenVersion,
  writeLastSeenVersion
} from "./releaseNotesStorage";
import type { ReleaseInfo } from "./types";
import { compareVersions } from "./version";

interface UpdatesContextValue {
  hasUnreadNotes: boolean;
  isWhatsNewOpen: boolean;
  isUpdateOpen: boolean;
  availableUpdate: ReleaseInfo | null;
  openWhatsNew: () => void;
  closeDialog: () => void;
  openUpdatePage: () => void;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

function getInitialUnreadState(): boolean {
  const lastSeenVersion =
    typeof window === "undefined"
      ? null
      : readLastSeenVersion(window.localStorage);

  return hasUnreadReleaseNotes(PRODUCT_VERSION, lastSeenVersion);
}

interface UpdatesProviderProps {
  fetcher?: typeof fetch;
}

export function UpdatesProvider({
  children,
  fetcher
}: PropsWithChildren<UpdatesProviderProps>) {
  const { generalSettings } = useSettings();
  const [hasUnreadNotes, setHasUnreadNotes] = useState(
    getInitialUnreadState
  );
  const [activeDialog, setActiveDialog] = useState<
    "whats-new" | "update" | null
  >(null);
  const [availableUpdate, setAvailableUpdate] =
    useState<ReleaseInfo | null>(null);
  const hasCheckedForUpdates = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    if (hasCheckedForUpdates.current) {
      return () => {
        isMounted.current = false;
      };
    }

    hasCheckedForUpdates.current = true;

    if (!generalSettings.autoCheckUpdates) {
      return () => {
        isMounted.current = false;
      };
    }

    void fetchLatestRelease(fetcher).then((release) => {
      if (
        isMounted.current &&
        release &&
        compareVersions(PRODUCT_VERSION, release.tagName) === -1
      ) {
        setAvailableUpdate(release);
        setActiveDialog("update");
      }
    });

    return () => {
      isMounted.current = false;
    };
  }, [fetcher, generalSettings.autoCheckUpdates]);

  const openWhatsNew = useCallback(() => {
    writeLastSeenVersion(
      PRODUCT_VERSION,
      typeof window === "undefined" ? undefined : window.localStorage
    );
    setHasUnreadNotes(false);
    setActiveDialog("whats-new");
  }, []);

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
  }, []);

  const openUpdatePage = useCallback(() => {
    if (availableUpdate && openExternalUrl(availableUpdate.htmlUrl)) {
      setActiveDialog(null);
    }
  }, [availableUpdate]);

  const value = useMemo<UpdatesContextValue>(
    () => ({
      hasUnreadNotes,
      isWhatsNewOpen: activeDialog === "whats-new",
      isUpdateOpen: activeDialog === "update",
      availableUpdate,
      openWhatsNew,
      closeDialog,
      openUpdatePage
    }),
    [
      activeDialog,
      availableUpdate,
      closeDialog,
      hasUnreadNotes,
      openUpdatePage,
      openWhatsNew
    ]
  );

  return (
    <UpdatesContext.Provider value={value}>
      {children}
    </UpdatesContext.Provider>
  );
}

export function useUpdates(): UpdatesContextValue {
  const context = useContext(UpdatesContext);

  if (!context) {
    throw new Error("useUpdates must be used inside UpdatesProvider.");
  }

  return context;
}
