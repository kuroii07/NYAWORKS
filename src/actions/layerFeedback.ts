import type { UiCopy } from "../i18n/types";
import type { ActionError } from "./types";

type LayerFailureCopy = UiCopy["home"]["layerFeedback"];

export function getLayerSuccessMessage(data: unknown, feedback: LayerFailureCopy): string | null {
  if (typeof data !== "object" || data === null || !("notice" in data)) return null;
  if (data.notice === "shape-controls-english") return feedback.shapeControlsEnglish;
  if (data.notice === "camera-controls-english") return feedback.cameraControlsEnglish;
  return null;
}

export function getLayerFailureMessage(
  error: ActionError | undefined,
  feedback: LayerFailureCopy
): string {
  const detail = error?.detail ?? "";
  const operationMessages: Record<string, string> = {
    "precomp-crop-3d-unsupported": feedback.precompCropUnsupported,
    "precomp-bounds-unavailable": feedback.precompCropUnavailable,
    "precomp-individual-dependency": feedback.precompIndividualDependency,
    "precomp-partial-failure": feedback.precompPartialFailure,
    "unprecompose-rollback-failed": feedback.unprecomposeRollbackFailed,
    "light-create-failed": feedback.lightCreateFailed,
    "light-rollback-failed": feedback.lightRollbackFailed
  };
  if (Object.prototype.hasOwnProperty.call(operationMessages, detail)) return operationMessages[detail];
  if (detail.startsWith("unprecompose-failed:")) return feedback.unprecomposeFailed;
  const nullMessages: Record<string, string> = {
    "null-unsafe-selection": feedback.nullUnsafeSelection,
    "null-unsafe-transform": feedback.nullUnsafeTransform,
    "null-position-unavailable": feedback.nullPositionUnavailable,
    "null-create-failed": feedback.nullCreateFailed,
    "null-rollback-failed": feedback.nullRollbackFailed
  };
  if (Object.prototype.hasOwnProperty.call(nullMessages, detail)) return nullMessages[detail];
  if (error?.code === "pseudo-template-locale-unavailable" ||
      /^Error: pseudo-template-locale-unavailable(?:[:;]|$)/.test(detail) ||
      /^pseudo-template-locale-unavailable(?:[:;]|$)/.test(detail)) {
    return feedback.pseudoTemplateLocaleUnavailable;
  }
  if (/^(?:Error: )?(?:pseudo-template-missing|pseudo-catalog-missing)(?:[:;]|$)/.test(detail)) {
    return feedback.pseudoTemplateMissing;
  }
  let message: string;
  if (error?.code === "action-unavailable") {
    message = error.detail === "host"
      ? feedback.unavailable
      : error.detail === "activeComp"
        ? feedback.noActiveComp
        : error.detail === "selectedLayers"
          ? feedback.noSelectedLayer
          : feedback.hostError;
  } else if (error?.code === "no-active-comp") {
    message = feedback.noActiveComp;
  } else if (error?.code === "no-selected-layer") {
    message = feedback.noSelectedLayer;
  } else if (error?.code === "invalid-selection") {
    message = feedback.invalidSelection;
  } else if (error?.code === "unsupported-layer-type") {
    message = feedback.unsupportedLayerType;
  } else if (error?.code === "unsupported-precomp") {
    message = feedback.unsupportedPrecomp;
  } else if (error?.code === "unsafe-unprecompose") {
    message = feedback.unsafeUnprecompose;
  } else if (
    error?.code === "host-unavailable" ||
    error?.code === "unavailable"
  ) {
    message = feedback.unavailable;
  } else {
    message = feedback.hostError;
  }

  // Host details remain on the Action result for diagnostics; paths and
  // expression traces should not appear in product notifications.
  return message;
}
