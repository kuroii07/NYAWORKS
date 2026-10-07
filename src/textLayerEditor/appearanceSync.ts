import {
  textEditorAppearanceBridge,
  type TextEditorAppearance,
  type TextEditorAppearanceBridge
} from "../host/textEditorAppearanceBridge";

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
  bridge: TextEditorAppearanceBridge = textEditorAppearanceBridge
): () => void {
  let active = true;

  const read = async () => {
    const appearance = await bridge.readAppearance();
    if (!active || !appearance) return;
    onAppearance(appearance);
  };

  void read();

  return () => {
    active = false;
  };
}
