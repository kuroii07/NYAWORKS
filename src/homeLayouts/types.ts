import type { ToolGroupId, ToolId } from "../i18n/types";

export const HOME_LAYOUT_SCHEMA_VERSION = 1 as const;
export const HOME_GROUP_SLOT_COUNT = 7 as const;

export type HomeLayoutLabel =
  | { kind: "translation"; key: "creativeGeneral" | ToolGroupId }
  | { kind: "custom"; value: string };

export type HomeGroupIconId =
  | "folder"
  | "layers"
  | "curve"
  | "text"
  | "effects"
  | "project"
  | "camera"
  | "shape"
  | "media"
  | "sparkle";

export interface HomeLayoutGroup {
  id: string;
  name: HomeLayoutLabel;
  iconId: HomeGroupIconId;
  visible: boolean;
  toolSlots: Array<ToolId | null>;
}

export interface HomeLayout {
  id: string;
  name: HomeLayoutLabel;
  kind: "built-in" | "custom";
  groups: HomeLayoutGroup[];
  createdAt: string;
  updatedAt: string;
}
