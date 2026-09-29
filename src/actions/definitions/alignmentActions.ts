import {
  ALIGNMENT_ACTIONS,
  isLayerAlignmentAction,
  type AlignmentAction
} from "../alignmentTypes";
import type { NyaActionDefinition } from "../types";

const TITLES: Record<AlignmentAction, NyaActionDefinition["title"]> = {
  left: { zhCN: "左对齐", zhTW: "靠左對齊", en: "Align Left", ja: "左揃え", ko: "왼쪽 맞춤" },
  "center-x": { zhCN: "水平居中", zhTW: "水平置中", en: "Align Horizontal Center", ja: "水平方向中央揃え", ko: "가로 가운데 맞춤" },
  right: { zhCN: "右对齐", zhTW: "靠右對齊", en: "Align Right", ja: "右揃え", ko: "오른쪽 맞춤" },
  top: { zhCN: "顶部对齐", zhTW: "頂端對齊", en: "Align Top", ja: "上揃え", ko: "위쪽 맞춤" },
  "center-y": { zhCN: "垂直居中", zhTW: "垂直置中", en: "Align Vertical Center", ja: "垂直方向中央揃え", ko: "세로 가운데 맞춤" },
  bottom: { zhCN: "底部对齐", zhTW: "底端對齊", en: "Align Bottom", ja: "下揃え", ko: "아래쪽 맞춤" },
  "paragraph-left": { zhCN: "段落左对齐", zhTW: "段落靠左", en: "Paragraph Left", ja: "段落を左揃え", ko: "문단 왼쪽 맞춤" },
  "paragraph-center": { zhCN: "段落居中", zhTW: "段落置中", en: "Paragraph Center", ja: "段落を中央揃え", ko: "문단 가운데 맞춤" },
  "paragraph-right": { zhCN: "段落右对齐", zhTW: "段落靠右", en: "Paragraph Right", ja: "段落を右揃え", ko: "문단 오른쪽 맞춤" }
};

const ALIGNMENT_TERMS: NyaActionDefinition["title"] = {
  zhCN: "对齐",
  zhTW: "對齊",
  en: "Align",
  ja: "整列",
  ko: "정렬"
};

export function getAlignmentActionId(action: AlignmentAction): string {
  if (action === "paragraph-left") return "text.paragraph.left";
  if (action === "paragraph-center") return "text.paragraph.center";
  if (action === "paragraph-right") return "text.paragraph.right";
  return `layer.align.${action}`;
}

export function isAlignmentActionId(actionId: string): boolean {
  return ALIGNMENT_ACTIONS.some(
    (action) => getAlignmentActionId(action) === actionId
  );
}

export const ALIGNMENT_ACTION_DEFINITIONS: readonly NyaActionDefinition[] =
  ALIGNMENT_ACTIONS.map((action) => ({
    id: getAlignmentActionId(action),
    title: TITLES[action],
    description: {
      zhCN: `${ALIGNMENT_TERMS.zhCN}：${TITLES[action].zhCN}`,
      zhTW: `${ALIGNMENT_TERMS.zhTW}：${TITLES[action].zhTW}`,
      en: `${ALIGNMENT_TERMS.en}: ${TITLES[action].en}`,
      ja: `${ALIGNMENT_TERMS.ja}：${TITLES[action].ja}`,
      ko: `${ALIGNMENT_TERMS.ko}: ${TITLES[action].ko}`
    },
    icon: isLayerAlignmentAction(action) ? "BoundingBox" : "TextAlignLeft",
    category: isLayerAlignmentAction(action) ? "layer" : "text",
    requirements: ["host", "activeComp", "selectedLayers"],
    supportsPie: true,
    execute: {
      type: "host",
      command: "setAlignment",
      payload: isLayerAlignmentAction(action)
        ? { action, target: "smart" }
        : { action }
    },
    undoPolicy: "host-undo-group"
  }));
