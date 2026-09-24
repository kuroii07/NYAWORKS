import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { readStoredDensity, writeStoredDensity } from "./densityStorage";
import {
  DEFAULT_DENSITY_ID,
  type DensityId
} from "./types";

interface DensityContextValue {
  densityId: DensityId;
  setDensity: (densityId: DensityId) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

function getInitialDensity(): DensityId {
  if (typeof window === "undefined") {
    return DEFAULT_DENSITY_ID;
  }

  return readStoredDensity(window.localStorage);
}

export function DensityProvider({ children }: PropsWithChildren) {
  const [densityId, setDensityId] = useState<DensityId>(getInitialDensity);

  useLayoutEffect(() => {
    document.documentElement.dataset.density = densityId;
    writeStoredDensity(densityId, window.localStorage);
  }, [densityId]);

  const value = useMemo<DensityContextValue>(
    () => ({
      densityId,
      setDensity: setDensityId
    }),
    [densityId]
  );

  return (
    <DensityContext.Provider value={value}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext);

  if (!context) {
    throw new Error("useDensity must be used inside DensityProvider.");
  }

  return context;
}
