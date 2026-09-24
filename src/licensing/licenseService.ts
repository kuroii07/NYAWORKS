export type LicenseAction = "purchase" | "activate" | "manage-devices";
export type LicenseStatus = "not-configured";

export interface LicenseSnapshot {
  status: LicenseStatus;
  plan: string | null;
  currentDevice: string | null;
  activatedDevices: number;
  maxDevices: number;
}

export interface LicenseActionResult {
  ok: boolean;
  reason?: "not-configured";
}

export interface LicenseService {
  getSnapshot: () => Promise<LicenseSnapshot>;
  perform: (action: LicenseAction) => Promise<LicenseActionResult>;
}

export const UNCONFIGURED_LICENSE_SNAPSHOT: LicenseSnapshot = {
  status: "not-configured",
  plan: null,
  currentDevice: null,
  activatedDevices: 0,
  maxDevices: 0
};

export function createUnconfiguredLicenseService(): LicenseService {
  return {
    getSnapshot: async () => UNCONFIGURED_LICENSE_SNAPSHOT,
    perform: async () => ({ ok: false, reason: "not-configured" })
  };
}
