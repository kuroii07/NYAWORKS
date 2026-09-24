import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { PRODUCT_VERSION } from "../about/productInfo";
import {
  hasUnreadReleaseNotes,
  readLastSeenVersion,
  writeLastSeenVersion
} from "./releaseNotesStorage";

interface UpdatesContextValue {
  hasUnreadNotes: boolean;
  isWhatsNewOpen: boolean;
  openWhatsNew: () => void;
  closeDialog: () => void;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

function getInitialUnreadState(): boolean {
  const lastSeenVersion =
    typeof window === "undefined"
      ? null
      : readLastSeenVersion(window.localStorage);

  return hasUnreadReleaseNotes(PRODUCT_VERSION, lastSeenVersion);
}

export function UpdatesProvider({ children }: PropsWithChildren) {
  const [hasUnreadNotes, setHasUnreadNotes] = useState(
    getInitialUnreadState
  );
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);

  const openWhatsNew = useCallback(() => {
    writeLastSeenVersion(
      PRODUCT_VERSION,
      typeof window === "undefined" ? undefined : window.localStorage
    );
    setHasUnreadNotes(false);
    setIsWhatsNewOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsWhatsNewOpen(false);
  }, []);

  const value = useMemo<UpdatesContextValue>(
    () => ({
      hasUnreadNotes,
      isWhatsNewOpen,
      openWhatsNew,
      closeDialog
    }),
    [closeDialog, hasUnreadNotes, isWhatsNewOpen, openWhatsNew]
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
