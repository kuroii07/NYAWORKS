import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  Check,
  Lightbulb,
  PencilSimple,
  Plus,
  SelectionAll,
  SelectionBackground,
  Stack,
  Trash
} from "@phosphor-icons/react";
import { AppDialog } from "../components/AppDialog";
import { BannerWorkspace, type BannerToolId } from "../components/BannerWorkspace";
import { GlobalSearchPanel } from "../components/GlobalSearchPanel";
import { useToast } from "../notifications/ToastProvider";
import {
  CompactActionMenu,
  type CompactActionMenuItem
} from "../components/CompactActionMenu";
import {
  getHomeLayoutLabel,
  HOME_GROUP_SLOT_COUNT,
  HOME_TOOL_CATALOG
} from "../homeLayouts/catalog";
import { moveToolBetweenGroups, setToolSlot } from "../homeLayouts/layoutOperations";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  getPointerAutoScrollDelta,
  hasPointerDragExceededThreshold
} from "../interactions/pointerReorder";
import { useSettings } from "../settings/SettingsProvider";
import { getActiveHomeLayout } from "../settings/homeSettingsStorage";
import { useActionService } from "../actions/ActionServiceProvider";
import { getAnchorFailureMessage } from "../actions/anchorFeedback";
import { getAlignmentFailureMessage } from "../actions/alignmentFeedback";
import { getLayerFailureMessage } from "../actions/layerFeedback";
import { getAnchorActionId } from "../actions/definitions/anchorActions";
import { getAlignmentActionId } from "../actions/definitions/alignmentActions";
import { getLayerActionId } from "../actions/layerActionTypes";
import {
  AdjustmentLayerIcon,
  CameraLayerIcon,
  NullObjectIcon,
  PrecomposeIcon,
  ShapeLayerIcon,
  SolidLayerIcon,
  TextLayerIcon,
  UnprecomposeIcon
} from "../icons/layerCreationIcons";
import type { AlignmentAction } from "../actions/alignmentTypes";
import type {
  LayerAction,
  LayerActionModifier
} from "../actions/layerActionTypes";
import type { ActionRunOptions } from "../actions/types";
import type {
  HomeCreateMode,
  HomeSpaceMode
} from "../settings/types";
import type {
  LayerToolId,
  SpatialPositionId,
  ToolId,
  UiCopy
} from "../i18n/types";
import type { GlobalSearchItem } from "../search/types";

interface HomeToolDrag {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  active: boolean;
  sourceGroupId: string;
  sourceIndex: number;
  targetGroupId: string | null;
  targetIndex: number | null;
  blocked: boolean;
  toolId: ToolId;
  label: string;
}

type ToolIcon = ComponentType<IconProps>;

const CREATE_TOOLS: readonly {
  id: LayerToolId;
  icon: ToolIcon;
  action: LayerAction;
  modifiers: readonly LayerActionModifier[];
}[] = [
  { id: "textLayer", icon: TextLayerIcon, action: "create-text", modifiers: ["none"] },
  { id: "solidLayer", icon: SolidLayerIcon, action: "create-solid", modifiers: ["none"] },
  { id: "shapeLayer", icon: ShapeLayerIcon, action: "create-shape", modifiers: ["none", "alt", "ctrl", "shift"] },
  { id: "adjustmentLayer", icon: AdjustmentLayerIcon, action: "create-adjustment", modifiers: ["none"] },
  { id: "nullObject", icon: NullObjectIcon, action: "create-null", modifiers: ["none", "alt", "shift"] },
  { id: "camera", icon: CameraLayerIcon, action: "create-camera-rig", modifiers: ["none", "alt"] },
  { id: "light", icon: Lightbulb, action: "create-light", modifiers: ["none", "alt", "ctrl", "shift"] },
  { id: "precompose", icon: PrecomposeIcon, action: "precompose-selected", modifiers: ["none", "alt", "ctrl"] },
  { id: "unprecompose", icon: UnprecomposeIcon, action: "unprecompose-selected", modifiers: ["none"] }
] as const;

const SELECT_TOOLS: readonly { id: ToolId; icon: ToolIcon }[] = [
  { id: "allLayers", icon: SelectionAll },
  { id: "textLayers", icon: TextLayerIcon },
  { id: "solidLayers", icon: SolidLayerIcon },
  { id: "shapeLayers", icon: ShapeLayerIcon },
  { id: "adjustmentLayers", icon: AdjustmentLayerIcon },
  { id: "cameraLayers", icon: CameraLayerIcon },
  { id: "lightLayers", icon: Lightbulb },
  { id: "nullLayers", icon: NullObjectIcon },
  { id: "invertSelection", icon: SelectionBackground }
] as const;

const SPATIAL_POSITIONS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right"
] as const;

type SpatialPosition = SpatialPositionId;

const SPATIAL_ICON_COORDINATES: Record<
  SpatialPosition,
  { guideX: number; guideY: number; objectX: number; objectY: number; pointX: number; pointY: number }
> = {
  "top-left": { guideX: 7, guideY: 7, objectX: 10, objectY: 10, pointX: 5, pointY: 5 },
  top: { guideX: 16, guideY: 7, objectX: 12, objectY: 10, pointX: 13.5, pointY: 5 },
  "top-right": { guideX: 25, guideY: 7, objectX: 14, objectY: 10, pointX: 22, pointY: 5 },
  left: { guideX: 7, guideY: 16, objectX: 10, objectY: 13, pointX: 5, pointY: 13.5 },
  center: { guideX: 16, guideY: 16, objectX: 12, objectY: 13, pointX: 13.5, pointY: 13.5 },
  right: { guideX: 25, guideY: 16, objectX: 14, objectY: 13, pointX: 22, pointY: 13.5 },
  "bottom-left": { guideX: 7, guideY: 25, objectX: 10, objectY: 16, pointX: 5, pointY: 22 },
  bottom: { guideX: 16, guideY: 25, objectX: 12, objectY: 16, pointX: 13.5, pointY: 22 },
  "bottom-right": { guideX: 25, guideY: 25, objectX: 14, objectY: 16, pointX: 22, pointY: 22 }
};

function AnchorModeIcon() {
  return (
    <svg className="spatial-mode-icon" viewBox="0 0 32 32" aria-hidden="true">
      <rect className="spatial-svg__frame" x="8" y="8" width="16" height="16" rx="1.5" />
      <path className="spatial-svg__guide" d="M16 4v4M16 24v4M4 16h4M24 16h4" />
      <rect className="spatial-svg__marker" x="13.5" y="13.5" width="5" height="5" rx="0.8" />
    </svg>
  );
}

function AlignModeIcon() {
  return (
    <svg className="spatial-mode-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path className="spatial-svg__guide" d="M16 4v24" />
      <rect className="spatial-svg__object" x="10" y="7" width="12" height="5" rx="1" />
      <rect className="spatial-svg__object" x="10" y="20" width="12" height="5" rx="1" />
    </svg>
  );
}

function AnchorGridIcon({ position }: { position: SpatialPosition }) {
  const { pointX, pointY } = SPATIAL_ICON_COORDINATES[position];

  return (
    <svg className="anchor-grid-icon" viewBox="0 0 32 32" aria-hidden="true">
      <rect className="spatial-svg__frame" x="11" y="11" width="10" height="10" rx="1" />
      <rect className="spatial-svg__marker" x={pointX} y={pointY} width="5" height="5" rx="0.8" />
    </svg>
  );
}

type LayerAlignDirection = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type ParagraphAlignDirection = "left" | "center" | "right";

const ALIGNMENT_ACTIONS: readonly {
  position: SpatialPosition;
  kind: "layer" | "paragraph";
  direction: LayerAlignDirection | ParagraphAlignDirection;
  action: AlignmentAction;
}[] = [
  { position: "top-left", kind: "layer", direction: "left", action: "left" },
  { position: "top", kind: "layer", direction: "center-x", action: "center-x" },
  { position: "top-right", kind: "layer", direction: "right", action: "right" },
  { position: "left", kind: "layer", direction: "top", action: "top" },
  { position: "center", kind: "layer", direction: "center-y", action: "center-y" },
  { position: "right", kind: "layer", direction: "bottom", action: "bottom" },
  { position: "bottom-left", kind: "paragraph", direction: "left", action: "paragraph-left" },
  { position: "bottom", kind: "paragraph", direction: "center", action: "paragraph-center" },
  { position: "bottom-right", kind: "paragraph", direction: "right", action: "paragraph-right" }
] as const;

function LayerAlignIcon({ direction }: { direction: LayerAlignDirection }) {
  const guide = {
    left: "M7 5v22",
    "center-x": "M16 5v22",
    right: "M25 5v22",
    top: "M5 7h22",
    "center-y": "M5 16h22",
    bottom: "M5 25h22"
  }[direction];
  const object = {
    left: { x: 8, y: 11, width: 13, height: 10 },
    "center-x": { x: 9.5, y: 11, width: 13, height: 10 },
    right: { x: 11, y: 11, width: 13, height: 10 },
    top: { x: 11, y: 8, width: 10, height: 13 },
    "center-y": { x: 11, y: 9.5, width: 10, height: 13 },
    bottom: { x: 11, y: 11, width: 10, height: 13 }
  }[direction];

  return (
    <svg className="align-grid-icon align-grid-icon--layer" viewBox="0 0 32 32" aria-hidden="true">
      <path className="spatial-svg__guide" d={guide} />
      <rect
        className="spatial-svg__align-object"
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        rx="1.3"
      />
    </svg>
  );
}

function ParagraphAlignIcon({ direction }: { direction: ParagraphAlignDirection }) {
  const lines = {
    left: [
      [7, 23],
      [7, 19],
      [7, 26],
      [7, 16]
    ],
    center: [
      [9, 23],
      [11, 21],
      [7, 25],
      [10, 22]
    ],
    right: [
      [9, 25],
      [13, 25],
      [7, 25],
      [15, 25]
    ]
  }[direction];

  return (
    <svg className="align-grid-icon align-grid-icon--paragraph" viewBox="0 0 32 32" aria-hidden="true">
      {lines.map(([x1, x2], index) => (
        <path
          className="spatial-svg__paragraph-line"
          d={`M${x1} ${8 + index * 5.25}H${x2}`}
          key={`${x1}-${x2}`}
        />
      ))}
    </svg>
  );
}

function AlignGridIcon({ action }: { action: (typeof ALIGNMENT_ACTIONS)[number] }) {
  return action.kind === "layer" ? (
    <LayerAlignIcon direction={action.direction as LayerAlignDirection} />
  ) : (
    <ParagraphAlignIcon direction={action.direction as ParagraphAlignDirection} />
  );
}

function PlannedToolButton({
  icon: Icon,
  label,
  ariaSuffix,
  titleSuffix,
  planned = true,
  ...buttonProps
}: {
  icon: ToolIcon;
  label: string;
  ariaSuffix: string;
  titleSuffix: string;
  planned?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="tool-button"
      type="button"
      {...buttonProps}
      aria-label={`${label}${ariaSuffix}`}
      aria-disabled={planned || undefined}
      title={planned ? `${label}${titleSuffix}` : label}
    >
      <Icon aria-hidden="true" weight="regular" />
    </button>
  );
}

function CreateToolGrid({
  copy,
  mode,
  onLayerAction
}: {
  copy: UiCopy["home"];
  mode: HomeCreateMode;
  onLayerAction: (
    action: LayerAction,
    modifier: LayerActionModifier
  ) => void;
}) {
  const [variantMenu, setVariantMenu] = useState<LayerToolId | null>(null);
  const layers = [
    { id: "create", tools: CREATE_TOOLS },
    { id: "select", tools: SELECT_TOOLS }
  ] as const;

  return (
    <div className="create-grid" data-create-motion={mode}>
      {layers.map((layer) => {
        const active = layer.id === mode;

        return (
          <div
            aria-hidden={!active || undefined}
            className={`create-grid__layer create-grid__layer--${layer.id}`}
            data-active={active || undefined}
            key={layer.id}
          >
            {layer.tools.map((tool, index) => {
              const style = {
                "--create-motion-index": index
              } as CSSProperties;
              if (layer.id === "select") {
                return (
                  <PlannedToolButton
                    icon={tool.icon}
                    key={tool.id}
                    label={copy.toolLabels[tool.id]}
                    ariaSuffix={copy.plannedAriaSuffix}
                    titleSuffix={copy.plannedTitleSuffix}
                    tabIndex={active ? undefined : -1}
                    style={style}
                  />
                );
              }

              const createTool = tool as (typeof CREATE_TOOLS)[number];
              const CreateIcon = createTool.icon;
              const menuItems: readonly CompactActionMenuItem[] = createTool.modifiers.map((modifier) => ({
                id: modifier,
                label: `${copy.toolLabels[createTool.id]} · ${
                  copy.layerActionVariantLabels[createTool.id]?.[modifier] ??
                  (modifier === "none" ? copy.layerActionMenuDefault : modifier.toUpperCase())
                }`,
                icon: createTool.icon,
                onSelect: () => onLayerAction(createTool.action, modifier)
              }));
              return (
                <div className="create-tool-cell" key={createTool.id} style={style}>
                  <button
                    className="tool-button"
                    type="button"
                    aria-label={copy.toolLabels[createTool.id]}
                    title={copy.layerActionTooltips[createTool.id]}
                    tabIndex={active ? undefined : -1}
                    onClick={(event) => {
                      if (
                        event.altKey &&
                        event.ctrlKey &&
                        event.shiftKey &&
                        createTool.modifiers.length > 1
                      ) {
                        setVariantMenu(createTool.id);
                        return;
                      }
                      const candidate: LayerActionModifier = event.shiftKey
                        ? "shift"
                        : event.ctrlKey
                          ? "ctrl"
                          : event.altKey
                            ? "alt"
                            : "none";
                      onLayerAction(
                        createTool.action,
                        createTool.modifiers.some((modifier) => modifier === candidate)
                          ? candidate
                          : "none"
                      );
                    }}
                  >
                    <CreateIcon aria-hidden="true" weight="regular" />
                  </button>
                  <CompactActionMenu
                    ariaLabel={copy.toolLabels[createTool.id]}
                    open={variantMenu === createTool.id}
                    items={menuItems}
                    onClose={() => setVariantMenu(null)}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function SpatialGrid({
  copy,
  mode,
  onAnchorPosition,
  onAlignment
}: {
  copy: UiCopy["home"];
  mode: HomeSpaceMode;
  onAnchorPosition?: (position: SpatialPosition) => void;
  onAlignment?: (
    action: AlignmentAction,
    options?: ActionRunOptions
  ) => void;
}) {
  const layers = ["anchor", "align"] as const;

  return (
    <div
      className={`anchor-grid ${
        mode === "align" ? "anchor-grid--align" : "anchor-grid--anchor"
      }`}
      data-spatial-motion={mode}
      aria-label={mode === "anchor" ? copy.anchorGridAria : copy.alignGridAria}
    >
      {layers.map((layer) => {
        const active = layer === mode;

        return (
          <div
            aria-hidden={!active || undefined}
            className={`spatial-grid__layer spatial-grid__layer--${layer}`}
            data-active={active || undefined}
            key={layer}
          >
            {SPATIAL_POSITIONS.map((position, index) => {
              const alignmentAction = ALIGNMENT_ACTIONS[index];
              const tooltip =
                layer === "anchor"
                  ? copy.spatialPositionLabels[position]
                  : copy.alignPositionLabels[position];

              return (
                <button
                  className="anchor-button"
                  data-position={position}
                  data-motion-index={index}
                  key={position}
                  style={
                    {
                      "--spatial-motion-index": index
                    } as CSSProperties
                  }
                  tabIndex={active ? undefined : -1}
                  type="button"
                  aria-label={tooltip}
                  title={tooltip}
                  onClick={
                    layer === "anchor"
                      ? () => onAnchorPosition?.(position)
                      : (event) =>
                          onAlignment?.(
                            alignmentAction.action,
                            event.altKey || event.shiftKey
                              ? { alignmentTarget: "composition" }
                              : undefined
                          )
                  }
                >
                  <span className="spatial-icon" aria-hidden="true">
                    {layer === "anchor" ? (
                      <AnchorGridIcon position={position} />
                    ) : (
                      <AlignGridIcon action={alignmentAction} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function HomePage({
  onEditLayout: _onEditLayout
}: {
  onEditLayout?: () => void;
}) {
  const { copy } = useLanguage();
  const { generalSettings, homeSettings, updateHomeSettings } = useSettings();
  const { toast } = useToast();
  const actionService = useActionService();
  const home = copy.home;
  const activeLayout = getActiveHomeLayout(homeSettings);
  const layoutName = getHomeLayoutLabel(activeLayout.name, copy);
  const visibleToolGroups = activeLayout.groups.filter((group) => group.visible);
  const [isEditing, setIsEditing] = useState(false);
  const [bannerToolId, setBannerToolId] = useState<BannerToolId | null>(null);
  const [toolTarget, setToolTarget] = useState<{
    groupId: string;
    slotIndex: number;
  } | null>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [slotMenuKey, setSlotMenuKey] = useState<string | null>(null);
  const [toolDrag, setToolDrag] = useState<HomeToolDrag | null>(null);
  const toolDragRef = useRef<HomeToolDrag | null>(null);
  const suppressToolClickRef = useRef(false);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollPointerYRef = useRef<number | null>(null);
  const flipRectsRef = useRef<Map<string, DOMRect> | null>(null);

  toolDragRef.current = toolDrag;

  async function handleAnchorPosition(position: SpatialPosition) {
    const result = await actionService.run(getAnchorActionId(position));
    if (result.success) {
      return;
    }

    toast.error(getAnchorFailureMessage(result.error, home.anchorFeedback));
    console.warn("NYAWORKS anchor action failed", result.error);
  }

  async function handleAlignment(
    action: AlignmentAction,
    options?: ActionRunOptions
  ) {
    const result = await actionService.run(
      getAlignmentActionId(action),
      options
    );
    if (result.success) {
      return;
    }

    toast.error(
      getAlignmentFailureMessage(
        result.error,
        home.alignmentFeedback
      )
    );
    console.warn("NYAWORKS alignment action failed", result.error);
  }

  async function handleLayerAction(
    action: LayerAction,
    modifier: LayerActionModifier
  ) {
    const result = await actionService.run(getLayerActionId(action), {
      layerModifier: modifier
    });
    if (result.success) {
      return;
    }

    toast.error(getLayerFailureMessage(result.error, home.layerFeedback));
    console.warn("NYAWORKS layer action failed", result.error);
  }

  const visibleTools = useMemo(
    () =>
      Object.values(HOME_TOOL_CATALOG).filter((tool) =>
        home.toolLabels[tool.id]
          .toLocaleLowerCase()
          .includes(toolSearch.trim().toLocaleLowerCase())
      ),
    [home.toolLabels, toolSearch]
  );

  function handleSearchExecute(item: GlobalSearchItem) {
    if (!item.opensBanner || !item.toolId) return;
    if (item.toolId === "adjust" || item.toolId === "effects" || item.toolId === "quickPreset") {
      setBannerToolId(item.toolId);
    }
  }

  function startEditing() {
    setIsEditing(true);
  }

  function beginToolDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    groupId: string,
    slotIndex: number,
    toolId: ToolId,
    label: string
  ) {
    if (event.button !== 0 || !isEditing || toolDragRef.current) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSlotMenuKey(null);
    setToolDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      active: false,
      sourceGroupId: groupId,
      sourceIndex: slotIndex,
      targetGroupId: groupId,
      targetIndex: slotIndex,
      blocked: false,
      toolId,
      label
    });
  }

  function stopAutoScroll() {
    autoScrollPointerYRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }

  function startAutoScroll() {
    if (autoScrollFrameRef.current !== null) {
      return;
    }

    const scroll = () => {
      const drag = toolDragRef.current;
      const pointerY = autoScrollPointerYRef.current;
      const workspace = document.querySelector<HTMLElement>(".home-workspace");

      if (!drag?.active || pointerY === null || !workspace) {
        autoScrollFrameRef.current = null;
        return;
      }

      const bounds = workspace.getBoundingClientRect();
      const delta = getPointerAutoScrollDelta(pointerY, {
        top: bounds.top,
        bottom: bounds.bottom
      });

      if (delta !== 0) {
        workspace.scrollTop += delta;
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(scroll);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(scroll);
  }

  function captureFlipRects() {
    const rects = new Map<string, DOMRect>();
    document
      .querySelectorAll<HTMLElement>("[data-home-reorder-key]")
      .forEach((element) => {
        const key = element.dataset.homeReorderKey;
        if (key) {
          rects.set(key, element.getBoundingClientRect());
        }
      });
    flipRectsRef.current = rects;
  }

  useLayoutEffect(() => {
    const previousRects = flipRectsRef.current;
    if (!previousRects || typeof document === "undefined") {
      return;
    }

    flipRectsRef.current = null;
    const duration =
      document.documentElement.dataset.motion === "off"
        ? 0
        : document.documentElement.dataset.motion === "reduced"
          ? 110
          : 180;

    if (duration === 0) {
      return;
    }

    document
      .querySelectorAll<HTMLElement>("[data-home-reorder-key]")
      .forEach((element) => {
        const key = element.dataset.homeReorderKey;
        const previous = key ? previousRects.get(key) : null;
        if (!previous || typeof element.animate !== "function") {
          return;
        }

        const next = element.getBoundingClientRect();
        const deltaX = previous.left - next.left;
        const deltaY = previous.top - next.top;

        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
          return;
        }

        element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0, 0)" }
          ],
          {
            duration,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
          }
        );
      });
  }, [activeLayout.groups]);

  useEffect(() => {
    if (!toolDrag) {
      return;
    }

    function finish(commit: boolean) {
      const drag = toolDragRef.current;
      stopAutoScroll();
      delete document.documentElement.dataset.reordering;

      if (drag?.active) {
        suppressToolClickRef.current = true;
        window.setTimeout(() => {
          suppressToolClickRef.current = false;
        }, 0);
      }

      if (
        commit &&
        drag?.active &&
        !drag.blocked &&
        drag.targetGroupId &&
        drag.targetIndex !== null &&
        (drag.sourceGroupId !== drag.targetGroupId ||
          drag.sourceIndex !== drag.targetIndex)
      ) {
        captureFlipRects();
        updateHomeSettings(
          moveToolBetweenGroups(
            homeSettings,
            activeLayout.id,
            drag.sourceGroupId,
            drag.sourceIndex,
            drag.targetGroupId,
            drag.targetIndex
          )
        );
      }

      toolDragRef.current = null;
      setToolDrag(null);
    }

    function handlePointerMove(event: PointerEvent) {
      const current = toolDragRef.current;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }

      const active =
        current.active ||
        hasPointerDragExceededThreshold(
          { x: current.startX, y: current.startY },
          { x: event.clientX, y: event.clientY }
        );
      if (!active) {
        return;
      }

      event.preventDefault();
      document.documentElement.dataset.reordering = "true";
      autoScrollPointerYRef.current = event.clientY;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-home-tool-drop-group]");
      const groupTarget = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-home-group-drop-id]");
      const targetGroupId =
        target?.dataset.homeToolDropGroup ??
        groupTarget?.dataset.homeGroupDropId ??
        null;
      const targetGroup = activeLayout.groups.find(
        (group) => group.id === targetGroupId
      );
      const toolCount =
        targetGroup?.toolSlots.filter((toolId) => Boolean(toolId)).length ?? 0;
      const parsedTargetIndex = Number(target?.dataset.homeToolDropIndex);
      const targetIndex = target
        ? Math.min(
            Number.isInteger(parsedTargetIndex) ? parsedTargetIndex : toolCount,
            HOME_GROUP_SLOT_COUNT - 1
          )
        : targetGroupId
          ? Math.min(toolCount, HOME_GROUP_SLOT_COUNT - 1)
          : null;
      const blocked = Boolean(
        targetGroupId &&
          targetGroupId !== current.sourceGroupId &&
          toolCount >= HOME_GROUP_SLOT_COUNT
      );

      const next = {
        ...current,
        active: true,
        x: event.clientX,
        y: event.clientY,
        targetGroupId,
        targetIndex,
        blocked
      };
      toolDragRef.current = next;
      setToolDrag(next);
      startAutoScroll();
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId === toolDragRef.current?.pointerId) {
        finish(true);
      }
    }

    function handlePointerCancel(event: PointerEvent) {
      if (event.pointerId === toolDragRef.current?.pointerId) {
        finish(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        finish(false);
      }
    }

    document.addEventListener("pointermove", handlePointerMove, { passive: false });
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.removeEventListener("keydown", handleKeyDown);
      stopAutoScroll();
      delete document.documentElement.dataset.reordering;
    };
  }, [toolDrag?.pointerId, activeLayout.id, activeLayout.groups, homeSettings]);

  useEffect(
    () => () => {
      stopAutoScroll();
    },
    []
  );

  return (
    <main className="home-workspace">
      <GlobalSearchPanel onExecute={handleSearchExecute} />

      {generalSettings.homeBannerEnabled ? (
        <BannerWorkspace toolId={bannerToolId} onToolChange={setBannerToolId} />
      ) : null}

      <div className="shortcut-heading">
        <span aria-hidden="true" />
        <h2>{layoutName}</h2>
        <button
          type="button"
          aria-label={home.editAria}
          title={home.editTitle}
          data-active={isEditing || undefined}
          onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
        >
          {isEditing ? <Check aria-hidden="true" /> : <PencilSimple aria-hidden="true" />}
          {isEditing ? copy.settings.home.finishEditing : home.edit}
        </button>
      </div>

      {homeSettings.showQuickPanels ? (
        <section className="quick-panels" aria-label={home.quickToolsAria}>
          <article className="quick-panel">
          <h3>
            <span aria-hidden="true" />
            {homeSettings.createMode === "create"
              ? home.createPanelTitle
              : home.selectPanelTitle}
          </h3>
          <div
            className="mode-switch"
            data-active-index={homeSettings.createMode === "create" ? 0 : 1}
            aria-label={home.createSwitchAria}
          >
            <button
              type="button"
              data-active={homeSettings.createMode === "create" || undefined}
              aria-pressed={homeSettings.createMode === "create"}
              title={copy.settings.home.create}
              onClick={() =>
                updateHomeSettings({ createMode: "create" as HomeCreateMode })
              }
            >
              <Stack aria-hidden="true" />
            </button>
            <button
              type="button"
              data-active={homeSettings.createMode === "select" || undefined}
              aria-pressed={homeSettings.createMode === "select"}
              title={copy.settings.home.select}
              onClick={() =>
                updateHomeSettings({ createMode: "select" as HomeCreateMode })
              }
            >
              <SelectionAll aria-hidden="true" />
            </button>
          </div>
          <CreateToolGrid
            copy={home}
            mode={homeSettings.createMode}
            onLayerAction={handleLayerAction}
          />
          </article>

          <article className="quick-panel">
          <h3>
            <span aria-hidden="true" />
            {homeSettings.spaceMode === "anchor"
              ? home.spacePanelTitle
              : home.alignPanelTitle}
          </h3>
          <div
            className="mode-switch"
            data-active-index={homeSettings.spaceMode === "anchor" ? 0 : 1}
            aria-label={home.anchorSwitchAria}
          >
            <button
              type="button"
              data-active={homeSettings.spaceMode === "anchor" || undefined}
              aria-pressed={homeSettings.spaceMode === "anchor"}
              title={copy.settings.home.anchor}
              onClick={() =>
                updateHomeSettings({ spaceMode: "anchor" as HomeSpaceMode })
              }
            >
              <AnchorModeIcon />
            </button>
            <button
              type="button"
              data-active={homeSettings.spaceMode === "align" || undefined}
              aria-pressed={homeSettings.spaceMode === "align"}
              title={copy.settings.home.align}
              onClick={() =>
                updateHomeSettings({ spaceMode: "align" as HomeSpaceMode })
              }
            >
              <AlignModeIcon />
            </button>
          </div>
           <SpatialGrid
             copy={home}
             mode={homeSettings.spaceMode}
             onAnchorPosition={handleAnchorPosition}
             onAlignment={handleAlignment}
           />
          </article>
        </section>
      ) : null}

      <section className="tool-groups" aria-label={home.toolGroupsAria}>
        {visibleToolGroups.map((group, groupIndex) => (
          <article
            className="tool-group"
            data-home-layout-group="true"
            data-home-group-drop-id={group.id}
            data-tone={groupIndex % 2 === 0 ? "secondary" : "primary"}
            key={group.id}
          >
            <h3>
              <span aria-hidden="true" />
              {getHomeLayoutLabel(group.name, copy)}
            </h3>
            <div className="tool-group__grid">
              {group.toolSlots.map((toolId, slotIndex) => {
                const slotKey = `${group.id}:${slotIndex}`;
                if (!toolId) {
                  return (
                    <div
                      className="home-tool-slot-wrap"
                      data-home-reorder-key={`empty:${group.id}:${slotIndex}`}
                      key={`${group.id}-slot-${slotIndex}`}
                    >
                      <button
                        className="tool-button tool-button--empty"
                        data-home-layout-slot="true"
                        data-home-tool-drop-group={group.id}
                        data-home-tool-drop-index={slotIndex}
                        disabled={!isEditing}
                        type="button"
                        aria-label={`${copy.settings.home.emptySlot} ${slotIndex + 1}`}
                        title={`${copy.settings.home.emptySlot} ${slotIndex + 1}`}
                        onClick={() => {
                          setToolTarget({ groupId: group.id, slotIndex });
                          setToolSearch("");
                        }}
                      >
                        <Plus aria-hidden="true" weight="regular" />
                      </button>
                    </div>
                  );
                }

                const tool = HOME_TOOL_CATALOG[toolId];

                const menuItems: readonly CompactActionMenuItem[] = [
                  {
                    id: "replace",
                    label: copy.settings.home.replaceTool,
                    icon: PencilSimple,
                    onSelect: () => {
                      setToolTarget({ groupId: group.id, slotIndex });
                      setToolSearch("");
                    }
                  },
                  {
                    id: "remove",
                    label: copy.settings.home.removeTool,
                    icon: Trash,
                    danger: true,
                    onSelect: () =>
                      updateHomeSettings(
                        setToolSlot(
                          homeSettings,
                          activeLayout.id,
                          group.id,
                          slotIndex,
                          null
                        )
                      )
                  }
                ];

                return (
                  <div
                    className="home-tool-slot-wrap"
                    data-home-reorder-key={`tool:${group.id}:${toolId}:${group.toolSlots
                      .slice(0, slotIndex)
                      .filter((candidate) => candidate === toolId).length}`}
                    key={slotKey}
                  >
                    <PlannedToolButton
                      icon={tool.icon}
                      label={home.toolLabels[tool.id]}
                      ariaSuffix={home.plannedAriaSuffix}
                      titleSuffix={home.plannedTitleSuffix}
                      planned={!isEditing}
                      data-home-layout-slot="true"
                      data-home-tool-drop-group={group.id}
                      data-home-tool-drop-index={slotIndex}
                      data-reorder-enabled={isEditing || undefined}
                      data-dragging={
                        toolDrag?.active &&
                        toolDrag.sourceGroupId === group.id &&
                        toolDrag.sourceIndex === slotIndex
                          ? true
                          : undefined
                      }
                      data-drop-state={
                        toolDrag?.active &&
                        toolDrag.targetGroupId === group.id &&
                        toolDrag.targetIndex === slotIndex
                          ? toolDrag.blocked
                            ? "blocked"
                            : "active"
                          : undefined
                      }
                      onPointerDown={(event) =>
                        beginToolDrag(
                          event,
                          group.id,
                          slotIndex,
                          tool.id,
                          home.toolLabels[tool.id]
                        )
                      }
                      onClick={() => {
                        if (isEditing && !suppressToolClickRef.current) {
                          setToolTarget({ groupId: group.id, slotIndex });
                          setToolSearch("");
                        }
                      }}
                      onContextMenu={(event) => {
                        if (!isEditing) {
                          return;
                        }
                        event.preventDefault();
                        setSlotMenuKey(slotKey);
                      }}
                    />
                    <CompactActionMenu
                      ariaLabel={home.toolLabels[tool.id]}
                      open={isEditing && slotMenuKey === slotKey}
                      items={menuItems}
                      onClose={() => setSlotMenuKey(null)}
                    />
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      {toolDrag?.active ? (
        <div
          className="home-reorder-ghost"
          data-kind="tool"
          data-blocked={toolDrag.blocked || undefined}
          style={{
            left: toolDrag.x - toolDrag.offsetX,
            top: toolDrag.y - toolDrag.offsetY,
            width: toolDrag.width,
            height: toolDrag.height
          }}
          aria-hidden="true"
        >
          {(() => {
            const DragIcon = HOME_TOOL_CATALOG[toolDrag.toolId].icon;
            return <DragIcon weight="regular" />;
          })()}
          <span>{toolDrag.label}</span>
        </div>
      ) : null}

      {toolTarget ? (
        <AppDialog
          title={copy.settings.home.selectTool}
          primaryAction={{
            label: copy.settings.home.resetCancel,
            onClick: () => setToolTarget(null)
          }}
          onClose={() => setToolTarget(null)}
        >
          <div className="home-tool-picker">
            <input
              className="nyaworks-text-input"
              type="search"
              value={toolSearch}
              placeholder={home.searchPlaceholder}
              onChange={(event) => setToolSearch(event.target.value)}
            />
            <div className="home-tool-picker__grid">
              {visibleTools.map((tool) => {
                const ToolIcon = tool.icon;
                return (
                  <button
                    type="button"
                    key={tool.id}
                    title={home.toolLabels[tool.id]}
                    onClick={() => {
                      updateHomeSettings(
                        setToolSlot(
                          homeSettings,
                          activeLayout.id,
                          toolTarget.groupId,
                          toolTarget.slotIndex,
                          tool.id
                        )
                      );
                      setToolTarget(null);
                    }}
                  >
                    <ToolIcon aria-hidden="true" weight="regular" />
                    <span>{home.toolLabels[tool.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </AppDialog>
      ) : null}
    </main>
  );
}
