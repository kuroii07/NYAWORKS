import { ANCHOR_POSITIONS, type AnchorPosition } from "../anchorTypes";
import type { NyaActionDefinition } from "../types";

const TITLES: Record<AnchorPosition, NyaActionDefinition["title"]> = {
  "top-left": { zhCN: "左上", zhTW: "左上", en: "Top Left", ja: "左上", ko: "왼쪽 위" },
  top: { zhCN: "上", zhTW: "上", en: "Top", ja: "上", ko: "위" },
  "top-right": { zhCN: "右上", zhTW: "右上", en: "Top Right", ja: "右上", ko: "오른쪽 위" },
  left: { zhCN: "左", zhTW: "左", en: "Left", ja: "左", ko: "왼쪽" },
  center: { zhCN: "中心", zhTW: "中心", en: "Center", ja: "中央", ko: "가운데" },
  right: { zhCN: "右", zhTW: "右", en: "Right", ja: "右", ko: "오른쪽" },
  "bottom-left": { zhCN: "左下", zhTW: "左下", en: "Bottom Left", ja: "左下", ko: "왼쪽 아래" },
  bottom: { zhCN: "下", zhTW: "下", en: "Bottom", ja: "下", ko: "아래" },
  "bottom-right": { zhCN: "右下", zhTW: "右下", en: "Bottom Right", ja: "右下", ko: "오른쪽 아래" }
};

export function getAnchorActionId(position: AnchorPosition): string {
  return `layer.anchor.${position}`;
}

export const ANCHOR_ACTION_DEFINITIONS: readonly NyaActionDefinition[] =
  ANCHOR_POSITIONS.map((position) => ({
    id: getAnchorActionId(position),
    title: TITLES[position],
    description: {
      zhCN: `将锚点设置到${TITLES[position].zhCN}`,
      zhTW: `將錨點設定到${TITLES[position].zhTW}`,
      en: `Set anchor point to ${TITLES[position].en}`,
      ja: `アンカーポイントを${TITLES[position].ja}へ`,
      ko: `앵커 포인트를 ${TITLES[position].ko}(으)로`
    },
    icon: "Anchor",
    category: "layer",
    requirements: ["host", "activeComp", "selectedLayers"],
    supportsPie: true,
    execute: {
      type: "host",
      command: "setAnchorPoint",
      payload: { position }
    },
    undoPolicy: "host-undo-group"
  }));
