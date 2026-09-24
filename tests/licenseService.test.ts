import { describe, expect, it } from "vitest";
import {
  createUnconfiguredLicenseService,
  type LicenseAction
} from "../src/licensing/licenseService";

describe("license service skeleton", () => {
  it("never presents an unconfigured provider as an active license", async () => {
    const service = createUnconfiguredLicenseService();

    await expect(service.getSnapshot()).resolves.toEqual({
      status: "not-configured",
      plan: null,
      currentDevice: null,
      activatedDevices: 0,
      maxDevices: 0
    });
  });

  it.each<LicenseAction>(["purchase", "activate", "manage-devices"])(
    "returns an explicit not-configured result for %s",
    async (action) => {
      const service = createUnconfiguredLicenseService();

      await expect(service.perform(action)).resolves.toEqual({
        ok: false,
        reason: "not-configured"
      });
    }
  );
});
