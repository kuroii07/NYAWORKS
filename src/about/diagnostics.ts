import type { DensityId } from "../density/types";
import type { AfterEffectsHostInfo } from "../host/cepBridge";
import type { LanguageId } from "../i18n/languages";
import type { ThemeId } from "../theme/types";

interface DiagnosticsInput {
  productVersion: string;
  extensionId: string;
  languageId: LanguageId;
  themeId: ThemeId;
  densityId: DensityId;
  hostInfo: AfterEffectsHostInfo;
}

export interface DiagnosticsReport
  extends Omit<DiagnosticsInput, "hostInfo"> {
  generatedAt: string;
  host: AfterEffectsHostInfo;
}

export function createDiagnosticsReport(
  input: DiagnosticsInput
): DiagnosticsReport {
  return {
    generatedAt: new Date().toISOString(),
    productVersion: input.productVersion,
    extensionId: input.extensionId,
    languageId: input.languageId,
    themeId: input.themeId,
    densityId: input.densityId,
    host: input.hostInfo
  };
}

export function downloadDiagnosticsReport(report: DiagnosticsReport): boolean {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }

  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = report.generatedAt.slice(0, 10);

  link.href = url;
  link.download = `nyaworks-diagnostics-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);

  return true;
}
