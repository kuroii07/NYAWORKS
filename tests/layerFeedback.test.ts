import { describe, expect, it } from "vitest";
import { getLayerFailureMessage, getLayerSuccessMessage } from "../src/actions/layerFeedback";
import { UI_COPY } from "../src/i18n/translations";
import { LANGUAGE_IDS } from "../src/i18n/languages";

describe("localized shape capability feedback", () => {
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
