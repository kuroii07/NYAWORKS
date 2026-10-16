import { resolveLayerLanguage } from "./layerLanguage";

// Host's ES3 mirror is checked against this catalog by the Host contract tests.
// These are object names, not Action IDs or translated menu labels.
export const LAYER_DISPLAY_NAMES = {
  text: { "zh-CN": "text", "zh-TW": "text", en: "text", ja: "text", ko: "text" },
  solid: { "zh-CN": "Nya 纯色", "zh-TW": "Nya 純色", en: "Nya Solid", ja: "Nya 平面", ko: "Nya 단색" },
  shape: { "zh-CN": "Nya 圆角矩形", "zh-TW": "Nya 圓角矩形", en: "Nya Rounded Rectangle", ja: "Nya 角丸長方形", ko: "Nya 둥근 사각형" },
  adjustment: { "zh-CN": "Nya 调整层", "zh-TW": "Nya 調整圖層", en: "Nya Adjustment", ja: "Nya 調整レイヤー", ko: "Nya 조정 레이어" },
  null: { "zh-CN": "Nya 控制", "zh-TW": "Nya 控制", en: "Nya Control", ja: "Nya コントロール", ko: "Nya 컨트롤" },
  camera: { "zh-CN": "Nya 摄像机", "zh-TW": "Nya 攝影機", en: "Nya Camera", ja: "Nya カメラ", ko: "Nya 카메라" },
  cameraController: { "zh-CN": "Nya 摄像机控制", "zh-TW": "Nya 攝影機控制", en: "Nya Camera Control", ja: "Nya カメラコントロール", ko: "Nya 카메라 컨트롤" },
  light: { "zh-CN": "Nya 灯光", "zh-TW": "Nya 燈光", en: "Nya Light", ja: "Nya ライト", ko: "Nya 조명" },
  lightPoint: { "zh-CN": "Nya 点光", "zh-TW": "Nya 點光", en: "Nya Point Light", ja: "Nya ポイントライト", ko: "Nya 포인트 조명" },
  lightSpot: { "zh-CN": "Nya 聚光", "zh-TW": "Nya 聚光", en: "Nya Spot Light", ja: "Nya スポットライト", ko: "Nya 스포트 조명" },
  lightParallel: { "zh-CN": "Nya 平行光", "zh-TW": "Nya 平行光", en: "Nya Parallel Light", ja: "Nya 平行ライト", ko: "Nya 평행 조명" },
  lightAmbient: { "zh-CN": "Nya 环境光", "zh-TW": "Nya 環境光", en: "Nya Ambient Light", ja: "Nya アンビエントライト", ko: "Nya 주변광" },
  // Precompose uses this as a suffix after the selected layer's existing name.
  precompose: { "zh-CN": "Precomp", "zh-TW": "預合成", en: "Precomp", ja: "プリコンポーズ", ko: "사전 구성" },
  // Unprecompose copies existing layers; this label must never rename them.
  unprecompose: { "zh-CN": "解预合成", "zh-TW": "解預合成", en: "Unprecompose", ja: "プリコンポーズを解除", ko: "사전 구성 해제" }
} as const;

export type LayerObjectId = keyof typeof LAYER_DISPLAY_NAMES;

export function getLayerDisplayName(objectId: LayerObjectId, languageId?: unknown): string {
  if (!Object.prototype.hasOwnProperty.call(LAYER_DISPLAY_NAMES, objectId)) {
    throw new Error("unknown-layer-object");
  }
  return LAYER_DISPLAY_NAMES[objectId][resolveLayerLanguage(languageId)];
}
