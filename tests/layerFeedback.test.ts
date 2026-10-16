import { describe, expect, it } from "vitest";
import { getLayerFailureMessage, getLayerSuccessMessage } from "../src/actions/layerFeedback";
import { UI_COPY } from "../src/i18n/translations";
import { LANGUAGE_IDS } from "../src/i18n/languages";

describe("localized shape capability feedback", () => {
  it.each(LANGUAGE_IDS)("distinguishes %s precompose safety and cleanup failures", language => {
    const feedback = UI_COPY[language].home.layerFeedback;
    const cases = [
      ["precomp-crop-3d-unsupported", feedback.precompCropUnsupported],
      ["precomp-bounds-unavailable", feedback.precompCropUnavailable],
      ["precomp-individual-dependency", feedback.precompIndividualDependency],
      ["precomp-partial-failure", feedback.precompPartialFailure],
      ["unprecompose-rollback-failed", feedback.unprecomposeRollbackFailed],
      ["unprecompose-failed:timing-2", feedback.unprecomposeFailed],
      ["light-create-failed", feedback.lightCreateFailed],
      ["light-rollback-failed", feedback.lightRollbackFailed]
    ];
    for (const [detail, message] of cases) {
      expect(message).toBeTruthy();
      expect(getLayerFailureMessage({ code: "host-error", detail }, feedback)).toBe(message);
    }
    expect(feedback.unprecomposeRollbackFailed).not.toBe(feedback.unprecomposeFailed);
  });
  it.each(LANGUAGE_IDS)("explains the camera English-controls notice in %s", language => {
    const feedback = UI_COPY[language].home.layerFeedback;
    expect(feedback.cameraControlsEnglish).toBeTruthy();
    expect(getLayerSuccessMessage({ notice: "camera-controls-english" }, feedback)).toBe(feedback.cameraControlsEnglish);
    expect(feedback.cameraControlsEnglish).not.toBe(feedback.shapeControlsEnglish);
  });
  it.each(LANGUAGE_IDS)("explains %s Null preflight and recovery failures", language => {
    const feedback = UI_COPY[language].home.layerFeedback;
    const messages = [feedback.nullUnsafeSelection, feedback.nullUnsafeTransform, feedback.nullPositionUnavailable, feedback.nullCreateFailed, feedback.nullRollbackFailed];
    const details = ["null-unsafe-selection", "null-unsafe-transform", "null-position-unavailable", "null-create-failed", "null-rollback-failed"];
    details.forEach((detail, index) => {
      expect(messages[index]).toBeTruthy();
      expect(getLayerFailureMessage({ code: "invalid-selection", detail }, feedback)).toBe(messages[index]);
    });
    expect(new Set(messages).size).toBe(5);
  });
  it.each(LANGUAGE_IDS)("explains the explicit %s English-controls notice and ignores other data", language => {
    const feedback = UI_COPY[language].home.layerFeedback;
    expect(getLayerSuccessMessage({ notice: "shape-controls-english" }, feedback)).toBe(feedback.shapeControlsEnglish);
    expect(feedback.shapeControlsEnglish).toBeTruthy();
    for (const data of [undefined, null, {}, { notice: "unexpected" }, "shape-controls-english"])
      expect(getLayerSuccessMessage(data, feedback)).toBeNull();
  });
  it.each(LANGUAGE_IDS)("explains an unavailable %s template without exposing diagnostics", language => {
    const feedback = UI_COPY[language].home.layerFeedback;
    const message = getLayerFailureMessage({ code: "host-error", detail: "Error: pseudo-template-locale-unavailable: ja; trace=C:/private/project.log" }, feedback);
    expect(message).toBe(feedback.pseudoTemplateLocaleUnavailable);
    expect(message).toBeTruthy();
    expect(message).not.toMatch(/C:|private|trace|pseudo-template/);
    expect(message).not.toBe(feedback.hostError);
  });
  it.each(LANGUAGE_IDS)("keeps generic %s layer errors free of paths and stack traces", language => {
    const feedback = UI_COPY[language].home.layerFeedback;
    expect(getLayerFailureMessage({ code: "host-error", detail: "Error: broken effect; trace=C:/private/project.log" }, feedback)).toBe(feedback.hostError);
  });
  it.each(LANGUAGE_IDS)("explains missing %s assets and retains readable fallback copy", language => {
    const feedback = UI_COPY[language].home.layerFeedback;
    expect(getLayerFailureMessage({ code: "host-error", detail: "Error: pseudo-template-missing" }, feedback)).toBe(feedback.pseudoTemplateMissing);
    expect(feedback.pseudoTemplateMissing).toBeTruthy();
    expect(feedback.pseudoEffectFallback).toBeTruthy();
  });
});
