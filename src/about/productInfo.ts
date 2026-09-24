export const PRODUCT_VERSION = "0.1.0-alpha.1";
export const EXTENSION_ID = "com.kuroii.nyaworks.panel";
export const AFTER_EFFECTS_SUPPORT = "After Effects 2021+";
export const CEP_RUNTIME_SUPPORT = "CEP / CSXS 11+";
export const GITHUB_REPOSITORY_URL =
  "https://github.com/kuroii07/NYAWORKS";
export const GITHUB_RELEASES_URL =
  "https://github.com/kuroii07/NYAWORKS/releases";

export function isSafeExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

interface ExternalLinkEnvironment {
  cep?: {
    util?: {
      openURLInDefaultBrowser?: (url: string) => void;
    };
  };
  open: (url: string, target: string, features: string) => unknown;
}

export function openExternalUrl(
  url: string,
  environment?: ExternalLinkEnvironment
): boolean {
  if (!isSafeExternalUrl(url)) {
    return false;
  }

  const activeEnvironment =
    environment ??
    (typeof window === "undefined"
      ? undefined
      : {
          cep: (
            window as Window & {
              cep?: ExternalLinkEnvironment["cep"];
            }
          ).cep,
          open: window.open.bind(window)
        });

  if (!activeEnvironment) {
    return false;
  }

  const cepOpen = activeEnvironment.cep?.util?.openURLInDefaultBrowser;
  if (cepOpen) {
    cepOpen(url);
    return true;
  }

  activeEnvironment.open(url, "_blank", "noopener,noreferrer");
  return true;
}
