import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  AnchorSimple,
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  ArrowsLeftRight,
  ArrowsOut,
  BezierCurve,
  BoundingBox,
  Camera,
  Circle,
  CopySimple,
  Cube,
  DiamondsFour,
  Equalizer,
  Eye,
  FileImage,
  FolderSimple,
  FolderSimplePlus,
  Folders,
  Lightbulb,
  Link,
  LinkBreak,
  MagicWand,
  MagnifyingGlass,
  Path,
  Plus,
  ProjectorScreen,
  Rectangle,
  SelectionAll,
  SelectionBackground,
  Shapes,
  SlidersHorizontal,
  Sparkle,
  Stack,
  Star,
  Steps,
  TextAlignLeft,
  TextT,
  Trash,
  VideoCamera,
  Waveform
} from "@phosphor-icons/react";
import type { ToolGroupId, ToolId, UiCopy } from "../i18n/types";
import type {
  HomeGroupIconId,
  HomeLayout,
  HomeLayoutLabel
} from "./types";
import { HOME_GROUP_SLOT_COUNT } from "./types";

export type HomeToolIcon = ComponentType<IconProps>;

export interface HomeToolDefinition {
  id: ToolId;
  icon: HomeToolIcon;
}

export const BUILT_IN_CREATIVE_LAYOUT_ID = "built-in:creative-general";

export const HOME_TOOL_CATALOG: Readonly<Record<ToolId, HomeToolDefinition>> = {
  textLayer: { id: "textLayer", icon: TextT },
  solidLayer: { id: "solidLayer", icon: Rectangle },
  shapeLayer: { id: "shapeLayer", icon: BoundingBox },
  threeDObject: { id: "threeDObject", icon: Cube },
  adjustmentLayer: { id: "adjustmentLayer", icon: SlidersHorizontal },
  precompose: { id: "precompose", icon: ProjectorScreen },
  camera: { id: "camera", icon: VideoCamera },
  light: { id: "light", icon: Lightbulb },
  nullObject: { id: "nullObject", icon: AnchorSimple },
  allLayers: { id: "allLayers", icon: SelectionAll },
  textLayers: { id: "textLayers", icon: TextT },
  solidLayers: { id: "solidLayers", icon: Rectangle },
  shapeLayers: { id: "shapeLayers", icon: BoundingBox },
  adjustmentLayers: { id: "adjustmentLayers", icon: SlidersHorizontal },
  cameraLayers: { id: "cameraLayers", icon: VideoCamera },
  lightLayers: { id: "lightLayers", icon: Lightbulb },
  nullLayers: { id: "nullLayers", icon: AnchorSimple },
  invertSelection: { id: "invertSelection", icon: SelectionBackground },
  newProjectFolder: { id: "newProjectFolder", icon: FolderSimplePlus },
  organizeProject: { id: "organizeProject", icon: Folders },
  duplicateComp: { id: "duplicateComp", icon: CopySimple },
  packageLayers: { id: "packageLayers", icon: Stack },
  fitComp: { id: "fitComp", icon: ArrowsOut },
  findFootage: { id: "findFootage", icon: MagnifyingGlass },
  removeUnused: { id: "removeUnused", icon: Trash },
  duplicateLayer: { id: "duplicateLayer", icon: CopySimple },
  linkParent: { id: "linkParent", icon: Link },
  unlinkParent: { id: "unlinkParent", icon: LinkBreak },
  moveUp: { id: "moveUp", icon: ArrowUp },
  moveDown: { id: "moveDown", icon: ArrowDown },
  reverseOrder: { id: "reverseOrder", icon: ArrowsLeftRight },
  soloLayers: { id: "soloLayers", icon: Eye },
  addKeyframe: { id: "addKeyframe", icon: DiamondsFour },
  graphEditor: { id: "graphEditor", icon: BezierCurve },
  steppedAnimation: { id: "steppedAnimation", icon: Steps },
  loopAnimation: { id: "loopAnimation", icon: ArrowsClockwise },
  sequenceAnimation: { id: "sequenceAnimation", icon: TextAlignLeft },
  timeOffset: { id: "timeOffset", icon: Waveform },
  easingControl: { id: "easingControl", icon: Equalizer },
  newText: { id: "newText", icon: TextT },
  textLayout: { id: "textLayout", icon: TextAlignLeft },
  splitText: { id: "splitText", icon: SelectionAll },
  rectangle: { id: "rectangle", icon: Rectangle },
  circle: { id: "circle", icon: Circle },
  star: { id: "star", icon: Star },
  path: { id: "path", icon: Path },
  effects: { id: "effects", icon: MagicWand },
  adjust: { id: "adjust", icon: SlidersHorizontal },
  quickPreset: { id: "quickPreset", icon: Sparkle },
  layerStyles: { id: "layerStyles", icon: Stack },
  linkEffects: { id: "linkEffects", icon: Link },
  audioResponse: { id: "audioResponse", icon: Waveform },
  moreTools: { id: "moreTools", icon: Plus }
};

export const HOME_GROUP_ICON_CATALOG: Readonly<
  Record<HomeGroupIconId, HomeToolIcon>
> = {
  folder: FolderSimple,
  layers: Stack,
  curve: BezierCurve,
  text: TextT,
  effects: MagicWand,
  project: ProjectorScreen,
  camera: Camera,
  shape: Shapes,
  media: FileImage,
  sparkle: Sparkle
};

function translatedGroup(
  id: ToolGroupId,
  iconId: HomeGroupIconId,
  toolSlots: ToolId[]
) {
  const normalizedSlots = [
    ...toolSlots.slice(0, HOME_GROUP_SLOT_COUNT),
    ...Array.from(
      { length: Math.max(0, HOME_GROUP_SLOT_COUNT - toolSlots.length) },
      () => null
    )
  ];

  return {
    id,
    name: { kind: "translation", key: id } as const,
    iconId,
    visible: true,
    toolSlots: normalizedSlots
  };
}

export const BUILT_IN_HOME_LAYOUTS: readonly HomeLayout[] = [
  {
    id: BUILT_IN_CREATIVE_LAYOUT_ID,
    kind: "built-in",
    name: { kind: "translation", key: "creativeGeneral" },
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    groups: [
      translatedGroup("compositionProject", "folder", [
        "newProjectFolder",
        "organizeProject",
        "duplicateComp",
        "packageLayers",
        "fitComp",
        "findFootage",
        "removeUnused"
      ]),
      translatedGroup("layerActions", "layers", [
        "duplicateLayer",
        "linkParent",
        "unlinkParent",
        "moveUp",
        "moveDown",
        "reverseOrder",
        "soloLayers"
      ]),
      translatedGroup("animationTime", "curve", [
        "addKeyframe",
        "graphEditor",
        "steppedAnimation",
        "loopAnimation",
        "sequenceAnimation",
        "timeOffset",
        "easingControl"
      ]),
      translatedGroup("textShapes", "text", [
        "newText",
        "textLayout",
        "splitText",
        "rectangle",
        "circle",
        "star",
        "path"
      ]),
      translatedGroup("effectsPresets", "effects", [
        "effects",
        "adjust",
        "quickPreset",
        "layerStyles",
        "linkEffects",
        "audioResponse",
        "moreTools"
      ])
    ]
  }
];

export function getHomeLayoutLabel(
  label: HomeLayoutLabel,
  copy: UiCopy
): string {
  if (label.kind === "custom") {
    return label.value;
  }

  return label.key === "creativeGeneral"
    ? copy.settings.home.layoutNames.creativeGeneral
    : copy.home.groupTitles[label.key];
}

export function isKnownHomeToolId(value: unknown): value is ToolId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(HOME_TOOL_CATALOG, value)
  );
}

export function isKnownHomeGroupIconId(
  value: unknown
): value is HomeGroupIconId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(HOME_GROUP_ICON_CATALOG, value)
  );
}

export { HOME_GROUP_SLOT_COUNT };
