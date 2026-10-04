import type { UiCopy } from "../i18n/types";
import type { ActionError } from "./types";

type LayerFailureCopy = UiCopy["home"]["layerFeedback"];

export function getLayerFailureMessage(
  error: ActionError | undefined,
  feedback: LayerFailureCopy
): string {
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

  return error?.detail && error.code !== "action-unavailable"
    ? `${message}（${error.detail}）`
    : message;
}
