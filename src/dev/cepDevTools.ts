import { getCepExtensionRoot } from "../host/cepBridge";

export const isCepDevBuild =
  typeof __NYAWORKS_CEP_DEV__ !== "undefined" && __NYAWORKS_CEP_DEV__;

export type ReloadableLocation = {
  reload: () => void;
};

type ReloadableCepEnvironment = {
  __adobe_cep__?: {
    evalScript: (script: string, callback: (result: string) => void) => void;
    getSystemPath?: (pathType: string) => string;
  };
};

const EXPECTED_HOST_REVISION = "layer-acceptance-host-20261016-1";

export function reloadCepHostScript(
  environment: ReloadableCepEnvironment =
    typeof window === "undefined"
      ? {}
      : (window as unknown as ReloadableCepEnvironment)
): Promise<boolean> {
  const runtime = environment.__adobe_cep__;
  const root = getCepExtensionRoot(environment);
  if (!runtime?.evalScript || !root) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const path = encodeURIComponent(root);
      const script = `(function(){try{` +
        `$.evalFile(new File(decodeURIComponent("${path}") + "/host/index.jsx"));` +
        `return JSON.stringify({ok:NYAWORKS.getHostRevision()==="${EXPECTED_HOST_REVISION}"});` +
        `}catch(error){return '{"ok":false}';}}())`;
      runtime.evalScript(script, (result) => {
        try {
          resolve((JSON.parse(result) as { ok?: unknown }).ok === true);
        } catch {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

export async function reloadCepPanel(
  locationLike: ReloadableLocation = window.location,
  environment: ReloadableCepEnvironment =
    typeof window === "undefined"
      ? {}
      : (window as unknown as ReloadableCepEnvironment)
): Promise<boolean> {
  const runtime = environment.__adobe_cep__;
  if (runtime?.evalScript && !await reloadCepHostScript(environment)) return false;
  locationLike.reload();
  return true;
}
