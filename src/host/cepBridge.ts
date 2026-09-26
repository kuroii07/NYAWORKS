export type HostConnectionStatus = "connected" | "unavailable" | "error";

export interface AfterEffectsHostInfo {
  status: HostConnectionStatus;
  name: string | null;
  version: string | null;
  projectName: string | null;
}

export interface HostCommandResult {
  ok: boolean;
  path?: string;
  reason?: "unavailable" | "host-error";
}

interface CepRuntime {
  evalScript: (script: string, callback: (result: string) => void) => void;
}

export interface CepEnvironment {
  __adobe_cep__?: CepRuntime;
}

export const UNAVAILABLE_HOST_INFO: AfterEffectsHostInfo = {
  status: "unavailable",
  name: null,
  version: null,
  projectName: null
};

function resolveEnvironment(environment?: CepEnvironment): CepEnvironment {
  if (environment) {
    return environment;
  }

  return typeof window === "undefined"
    ? {}
    : (window as unknown as CepEnvironment);
}

export function evaluateHostScript(
  script: string,
  environment?: CepEnvironment
): Promise<string | null> {
  const runtime = resolveEnvironment(environment).__adobe_cep__;

  if (!runtime?.evalScript) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      runtime.evalScript(script, resolve);
    } catch {
      resolve(null);
    }
  });
}

export async function readAfterEffectsHostInfo(
  environment?: CepEnvironment
): Promise<AfterEffectsHostInfo> {
  const result = await evaluateHostScript(
    "NYAWORKS.getHostInfo()",
    environment
  );

  if (result === null) {
    return UNAVAILABLE_HOST_INFO;
  }

  try {
    const parsed = JSON.parse(result) as {
      name?: unknown;
      version?: unknown;
      projectName?: unknown;
    };

    if (typeof parsed.version !== "string" || parsed.version.length === 0) {
      throw new Error("Missing host version");
    }

    return {
      status: "connected",
      name: typeof parsed.name === "string" ? parsed.name : "After Effects",
      version: parsed.version,
      projectName:
        typeof parsed.projectName === "string" ? parsed.projectName : null
    };
  } catch {
    return {
      ...UNAVAILABLE_HOST_INFO,
      status: "error"
    };
  }
}

export async function openHostDataDirectory(
  environment?: CepEnvironment
): Promise<HostCommandResult> {
  const result = await evaluateHostScript(
    "NYAWORKS.openDataDirectory()",
    environment
  );

  if (result === null) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const parsed = JSON.parse(result) as { ok?: unknown; path?: unknown };

    return parsed.ok === true
      ? {
          ok: true,
          path: typeof parsed.path === "string" ? parsed.path : undefined
        }
      : { ok: false, reason: "host-error" };
  } catch {
    return { ok: false, reason: "host-error" };
  }
}
