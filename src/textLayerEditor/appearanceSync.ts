import {
  textEditorAppearanceBridge,
  type TextEditorAppearance,
  type TextEditorAppearanceBridge
} from "../host/textEditorAppearanceBridge";

const DEFAULT_POLL_INTERVAL_MS = 400;
const PUBLISH_RETRY_INTERVAL_MS = 250;
const MAX_PUBLISH_ATTEMPTS = 8;

export function startTextEditorAppearancePublisher(
  appearance: TextEditorAppearance,
  bridge: TextEditorAppearanceBridge = textEditorAppearanceBridge
): () => void {
  let active = true;
  let attempts = 0;
  let retryId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const publish = async () => {
    attempts += 1;
    const published = await bridge.writeAppearance(appearance);
    if (!active || published || attempts >= MAX_PUBLISH_ATTEMPTS) return;
    retryId = globalThis.setTimeout(() => {
      void publish();
    }, PUBLISH_RETRY_INTERVAL_MS);
  };

  void publish();
  return () => {
    active = false;
    if (retryId !== null) globalThis.clearTimeout(retryId);
  };
}

export function startTextEditorAppearanceSubscriber(
  onAppearance: (appearance: TextEditorAppearance) => void,
  bridge: TextEditorAppearanceBridge = textEditorAppearanceBridge,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
): () => void {
  let active = true;
  let reading = false;
  let lastAppearanceKey: string | null = null;

  const poll = async () => {
    if (!active || reading) return;
    reading = true;
    const appearance = await bridge.readAppearance();
    reading = false;
    if (!active || !appearance) return;

    const appearanceKey = `${appearance.themeId}:${appearance.languageId}`;
    if (appearanceKey === lastAppearanceKey) return;
    lastAppearanceKey = appearanceKey;
    onAppearance(appearance);
  };

  void poll();
  const intervalId = globalThis.setInterval(() => {
    void poll();
  }, pollIntervalMs);

  return () => {
    active = false;
    globalThis.clearInterval(intervalId);
  };
}
