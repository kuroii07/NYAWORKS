export const TEXT_LAYER_EDITOR_EXTENSION_ID =
  "com.kuroii.nyaworks.text-editor";

interface CepRuntime {
  requestOpenExtension?(extensionId: string, params: string): void;
  closeExtension?(): void;
}

export interface TextLayerEditorCepEnvironment {
  __adobe_cep__?: CepRuntime;
}

function resolveEnvironment(
  environment?: TextLayerEditorCepEnvironment
): TextLayerEditorCepEnvironment {
  if (environment) return environment;
  return typeof window === "undefined"
    ? {}
    : (window as unknown as TextLayerEditorCepEnvironment);
}

export function openTextLayerEditor(
  environment?: TextLayerEditorCepEnvironment
): boolean {
  const runtime = resolveEnvironment(environment).__adobe_cep__;
  if (!runtime?.requestOpenExtension) return false;
  runtime.requestOpenExtension(TEXT_LAYER_EDITOR_EXTENSION_ID, "");
  return true;
}

export function closeTextLayerEditor(
  environment?: TextLayerEditorCepEnvironment
): boolean {
  const runtime = resolveEnvironment(environment).__adobe_cep__;
  if (!runtime?.closeExtension) return false;
  runtime.closeExtension();
  return true;
}

export function prepareTextLayerEditorKeyboard(
  _environment?: TextLayerEditorCepEnvironment
): boolean {
  if (typeof window !== "undefined") window.focus();
  return true;
}
