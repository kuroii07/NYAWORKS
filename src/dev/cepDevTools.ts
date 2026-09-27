export const isCepDevBuild =
  typeof __NYAWORKS_CEP_DEV__ !== "undefined" && __NYAWORKS_CEP_DEV__;

export type ReloadableLocation = {
  reload: () => void;
};

type ReloadableCepEnvironment = {
  __adobe_cep__?: {
    evalScript: (script: string, callback: (result: string) => void) => void;
  };
};

export function reloadCepPanel(
  locationLike: ReloadableLocation = window.location,
  environment: ReloadableCepEnvironment =
    typeof window === "undefined"
      ? {}
      : (window as unknown as ReloadableCepEnvironment)
): void {
  const runtime = environment.__adobe_cep__;
  if (runtime?.evalScript) {
    try {
      runtime.evalScript("NYAWORKS.reloadHostScript()", () => locationLike.reload());
      return;
    } catch {
      // Fall back to reloading the panel if the host bridge is unavailable.
    }
  }
  locationLike.reload();
}
