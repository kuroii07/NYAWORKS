import type { UiCopy } from "../i18n/types";
import type { ActionError } from "./types";

type AlignmentFailureCopy = UiCopy["home"]["alignmentFeedback"];

export function getAlignmentFailureMessage(
  error: ActionError | undefined,
  feedback: AlignmentFailureCopy
): string {
  let message: string;
  if (error?.code === "action-unavailable") {
    message = error.detail === "host"
      ? feedback.unavailable
      : error.detail === "selectedLayers"
        ? feedback.noSelectedLayer
        : feedback.hostError;
  } else if (error?.code === "no-selected-layer") {
    message = feedback.noSelectedLayer;
  } else if (error?.code === "no-text-layer") {
    message = feedback.noTextLayer;
  } else if (error?.code === "locked-layer") {
    message = feedback.lockedLayer;
  } else if (error?.code === "unsupported-layer") {
    message = feedback.unsupportedLayer;
  } else if (error?.code === "expression-conflict") {
    message = feedback.expressionConflict;
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
