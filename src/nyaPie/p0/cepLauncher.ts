export const NYA_PIE_P0_EXTENSION_ID = "com.kuroii.nyaworks.nyapie.p0";
export const NYA_PIE_P1_RUNTIME_TITLE = "NYAWORKS_NYA_PIE_RUNTIME_P1";

export interface CepKeyInterest {
  keyCode: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

interface CepRuntime {
  requestOpenExtension?(extensionId: string, params: string): void;
  closeExtension?(): void;
  registerKeyEventsInterest?(interest: string): boolean;
  invokeSync?(command: string, ...args: string[]): unknown;
}

export interface NyaPieCepEnvironment {
  __adobe_cep__?: CepRuntime;
}

export interface NyaPieLauncherCapabilities {
  modelessExtension: boolean;
  focusedKeyEvents: boolean;
  globalHotkey: false;
  globalCursorPosition: false;
  absoluteWindowPosition: false;
  restoreAeFocus: false;
}

export interface NyaPieCepLauncher {
  capabilities: NyaPieLauncherCapabilities;
  openRuntime(): boolean;
  closeRuntime(): boolean;
  setWindowTitle(title: string): boolean;
  registerFocusedKeyInterest(keys: readonly CepKeyInterest[]): boolean;
}

function resolveEnvironment(
  environment?: NyaPieCepEnvironment
): NyaPieCepEnvironment {
  if (environment) return environment;
  return typeof window === "undefined"
    ? {}
    : (window as unknown as NyaPieCepEnvironment);
}

export function createCepNyaPieLauncher(
  environment?: NyaPieCepEnvironment
): NyaPieCepLauncher {
  const runtime = resolveEnvironment(environment).__adobe_cep__;

  return {
    capabilities: {
      modelessExtension: typeof runtime?.requestOpenExtension === "function",
      focusedKeyEvents:
        typeof runtime?.registerKeyEventsInterest === "function",
      globalHotkey: false,
      globalCursorPosition: false,
      absoluteWindowPosition: false,
      restoreAeFocus: false
    },
    openRuntime() {
      if (!runtime?.requestOpenExtension) return false;
      runtime.requestOpenExtension(NYA_PIE_P0_EXTENSION_ID, "");
      return true;
    },
    closeRuntime() {
      if (!runtime?.closeExtension) return false;
      runtime.closeExtension();
      return true;
    },
    setWindowTitle(title) {
      if (!runtime?.invokeSync) return false;
      runtime.invokeSync("setWindowTitle", title);
      return true;
    },
    registerFocusedKeyInterest(keys) {
      if (!runtime?.registerKeyEventsInterest) return false;
      return runtime.registerKeyEventsInterest(JSON.stringify(keys));
    }
  };
}
