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
  AnchorSimple,
  BoundingBox,
  CaretDown,
  Check,
  Cube,
  Lightbulb,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ProjectorScreen,
  Rectangle,
  SelectionAll,
  SelectionBackground,
  SlidersHorizontal,
  Stack,
  TextT,
  Trash,
  VideoCamera
} from "@phosphor-icons/react";
import { AppDialog } from "../components/AppDialog";
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
import type {
  HomeCreateMode,
  HomeSpaceMode
} from "../settings/types";
import type { ToolId, UiCopy } from "../i18n/types";

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

const CREATE_TOOLS: readonly { id: ToolId; icon: ToolIcon }[] = [
  { id: "textLayer", icon: TextT },
  { id: "solidLayer", icon: Rectangle },
  { id: "shapeLayer", icon: BoundingBox },
  { id: "threeDObject", icon: Cube },
  { id: "adjustmentLayer", icon: SlidersHorizontal },
  { id: "precompose", icon: ProjectorScreen },
  { id: "camera", icon: VideoCamera },
  { id: "light", icon: Lightbulb },
  { id: "nullObject", icon: AnchorSimple }
] as const;

const SELECT_TOOLS: readonly { id: ToolId; icon: ToolIcon }[] = [
  { id: "allLayers", icon: SelectionAll },
  { id: "textLayers", icon: TextT },
  { id: "solidLayers", icon: Rectangle },
  { id: "shapeLayers", icon: BoundingBox },
  { id: "adjustmentLayers", icon: SlidersHorizontal },
  { id: "cameraLayers", icon: VideoCamera },
  { id: "lightLayers", icon: Lightbulb },
  { id: "nullLayers", icon: AnchorSimple },
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

type SpatialPosition = (typeof SPATIAL_POSITIONS)[number];

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

function AlignGridIcon({ position }: { position: SpatialPosition }) {
  const { guideX, guideY, objectX, objectY } = SPATIAL_ICON_COORDINATES[position];

  return (
    <svg className="align-grid-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path className="spatial-svg__guide" d={`M${guideX} 4v24M4 ${guideY}h24`} />
      <rect className="spatial-svg__object" x={objectX} y={objectY} width="8" height="6" rx="1" />
    </svg>
  );
}

function PlannedToolButton({
  icon: Icon,
  label,
  ariaSuffix,
  titleSuffix,
  emphasized = false,
  planned = true,
  ...buttonProps
}: {
  icon: ToolIcon;
  label: string;
  ariaSuffix: string;
  titleSuffix: string;
  emphasized?: boolean;
  planned?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="tool-button"
      data-emphasized={emphasized || undefined}
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
  mode
}: {
  copy: UiCopy["home"];
  mode: HomeCreateMode;
}) {
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
            {layer.tools.map((tool, index) => (
              <PlannedToolButton
                icon={tool.icon}
                key={tool.id}
                label={copy.toolLabels[tool.id]}
                ariaSuffix={copy.plannedAriaSuffix}
                titleSuffix={copy.plannedTitleSuffix}
                emphasized={index === 0}
                tabIndex={active ? undefined : -1}
                style={
                  {
                    "--create-motion-index": index
                  } as CSSProperties
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SpatialGrid({
  copy,
  mode
}: {
  copy: UiCopy["home"];
  mode: HomeSpaceMode;
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
        const label = layer === "anchor" ? copy.anchorLabel : copy.alignLabel;

        return (
          <div
            aria-hidden={!active || undefined}
            className={`spatial-grid__layer spatial-grid__layer--${layer}`}
            data-active={active || undefined}
            key={layer}
          >
            {SPATIAL_POSITIONS.map((position, index) => (
              <button
                className="anchor-button"
                data-position={position}
                data-selected={position === "center" || undefined}
                data-motion-index={index}
                key={position}
                style={
                  {
                    "--spatial-motion-index": index
                  } as CSSProperties
                }
                tabIndex={active ? undefined : -1}
                type="button"
                aria-label={`${position} ${label}${copy.plannedAriaSuffix}`}
                aria-disabled="true"
                title={`${label}${copy.plannedTitleSuffix}`}
              >
                <span className="spatial-icon" aria-hidden="true">
                  {layer === "anchor" ? (
                    <AnchorGridIcon position={position} />
                  ) : (
                    <AlignGridIcon position={position} />
                  )}
                </span>
              </button>
            ))}
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
  const home = copy.home;
  const activeLayout = getActiveHomeLayout(homeSettings);
  const layoutName = getHomeLayoutLabel(activeLayout.name, copy);
  const visibleToolGroups = activeLayout.groups.filter((group) => group.visible);
  const [isEditing, setIsEditing] = useState(false);
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

  const visibleTools = useMemo(
    () =>
      Object.values(HOME_TOOL_CATALOG).filter((tool) =>
        home.toolLabels[tool.id]
          .toLocaleLowerCase()
          .includes(toolSearch.trim().toLocaleLowerCase())
      ),
    [home.toolLabels, toolSearch]
  );

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
      <label className="global-search">
        <MagnifyingGlass aria-hidden="true" weight="regular" />
        <input
          type="search"
          placeholder={home.searchPlaceholder}
          aria-label={home.searchAria}
          readOnly
        />
        <span className="search-key">⌘</span>
        <span className="search-key">K</span>
      </label>

      {generalSettings.homeBannerEnabled ? (
        <section className="home-banner" aria-label="NYAWORKS">
          <div className="home-banner__copy">
            <h1>
              {home.bannerLead}
              <span>{home.bannerAccent}</span>
            </h1>
            <p>{home.bannerSubtitle}</p>
            <div className="home-banner__pager" aria-hidden="true">
              <span />
              <span />
            </div>
          </div>
          <CaretDown className="home-banner__caret" aria-hidden="true" />
        </section>
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
          <CreateToolGrid copy={home} mode={homeSettings.createMode} />
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
          <SpatialGrid copy={home} mode={homeSettings.spaceMode} />
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
