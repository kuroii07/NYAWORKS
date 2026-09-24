import type { ButtonHTMLAttributes, ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  AnchorSimple,
  BoundingBox,
  CaretDown,
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
  TextAlignLeft,
  TextT,
  VideoCamera
} from "@phosphor-icons/react";
import {
  getHomeLayoutLabel,
  HOME_TOOL_CATALOG
} from "../homeLayouts/catalog";
import { useLanguage } from "../i18n/LanguageProvider";
import { useSettings } from "../settings/SettingsProvider";
import { getActiveHomeLayout } from "../settings/homeSettingsStorage";
import type {
  HomeCreateMode,
  HomeSpaceMode
} from "../settings/types";
import type { ToolId, UiCopy } from "../i18n/types";

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

function PlannedToolButton({
  icon: Icon,
  label,
  ariaSuffix,
  titleSuffix,
  emphasized = false,
  ...buttonProps
}: {
  icon: ToolIcon;
  label: string;
  ariaSuffix: string;
  titleSuffix: string;
  emphasized?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="tool-button"
      data-emphasized={emphasized || undefined}
      type="button"
      {...buttonProps}
      aria-label={`${label}${ariaSuffix}`}
      aria-disabled="true"
      title={`${label}${titleSuffix}`}
    >
      <Icon aria-hidden="true" weight="regular" />
    </button>
  );
}

function SpatialGrid({
  copy,
  mode
}: {
  copy: UiCopy["home"];
  mode: HomeSpaceMode;
}) {
  const positions = [
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

  return (
    <div
      className="anchor-grid"
      aria-label={mode === "anchor" ? copy.anchorGridAria : copy.alignGridAria}
    >
      {positions.map((position) => (
        <button
          className="anchor-button"
          data-position={position}
          data-selected={position === "center" || undefined}
          key={position}
          type="button"
          aria-label={`${position} ${
            mode === "anchor" ? copy.anchorLabel : copy.alignLabel
          }${copy.plannedAriaSuffix}`}
          aria-disabled="true"
          title={`${
            mode === "anchor" ? copy.anchorLabel : copy.alignLabel
          }${copy.plannedTitleSuffix}`}
        >
          <span className="anchor-button__frame" aria-hidden="true">
            <span className="anchor-button__dot" />
          </span>
        </button>
      ))}
    </div>
  );
}

export function HomePage({
  onEditLayout
}: {
  onEditLayout?: () => void;
}) {
  const { copy } = useLanguage();
  const { generalSettings, homeSettings, updateHomeSettings } = useSettings();
  const home = copy.home;
  const activeCreateTools =
    homeSettings.createMode === "create" ? CREATE_TOOLS : SELECT_TOOLS;
  const activeLayout = getActiveHomeLayout(homeSettings);
  const layoutName = getHomeLayoutLabel(activeLayout.name, copy);
  const visibleToolGroups = activeLayout.groups.filter((group) => group.visible);

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
          onClick={onEditLayout}
        >
          <PencilSimple aria-hidden="true" />
          {home.edit}
        </button>
      </div>

      <section className="quick-panels" aria-label={home.quickToolsAria}>
        <article className="quick-panel">
          <h3>
            <span aria-hidden="true" />
            {homeSettings.createMode === "create"
              ? home.createPanelTitle
              : home.selectPanelTitle}
          </h3>
          <div className="mode-switch" aria-label={home.createSwitchAria}>
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
          <div className="create-grid">
            {activeCreateTools.map((tool, index) => (
              <PlannedToolButton
                icon={tool.icon}
                key={tool.id}
                label={home.toolLabels[tool.id]}
                ariaSuffix={home.plannedAriaSuffix}
                titleSuffix={home.plannedTitleSuffix}
                emphasized={index === 0}
              />
            ))}
          </div>
        </article>

        <article className="quick-panel">
          <h3>
            <span aria-hidden="true" />
            {homeSettings.spaceMode === "anchor"
              ? home.spacePanelTitle
              : home.alignPanelTitle}
          </h3>
          <div className="mode-switch" aria-label={home.anchorSwitchAria}>
            <button
              type="button"
              data-active={homeSettings.spaceMode === "anchor" || undefined}
              aria-pressed={homeSettings.spaceMode === "anchor"}
              title={copy.settings.home.anchor}
              onClick={() =>
                updateHomeSettings({ spaceMode: "anchor" as HomeSpaceMode })
              }
            >
              <AnchorSimple aria-hidden="true" />
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
              <TextAlignLeft aria-hidden="true" />
            </button>
          </div>
          <SpatialGrid copy={home} mode={homeSettings.spaceMode} />
        </article>
      </section>

      <section className="tool-groups" aria-label={home.toolGroupsAria}>
        {visibleToolGroups.map((group, groupIndex) => (
          <article
            className="tool-group"
            data-home-layout-group="true"
            data-tone={groupIndex % 2 === 0 ? "secondary" : "primary"}
            key={group.id}
          >
            <h3>
              <span aria-hidden="true" />
              {getHomeLayoutLabel(group.name, copy)}
            </h3>
            <div className="tool-group__grid">
              {group.toolSlots.map((toolId, slotIndex) => {
                if (!toolId) {
                  return (
                    <button
                      className="tool-button tool-button--empty"
                      data-home-layout-slot="true"
                      disabled
                      key={`${group.id}-slot-${slotIndex}`}
                      type="button"
                      aria-label={`${home.customSlotLabel} ${slotIndex + 1}`}
                      title={`${home.customSlotLabel} ${slotIndex + 1}`}
                    >
                      <Plus aria-hidden="true" weight="regular" />
                    </button>
                  );
                }

                const tool = HOME_TOOL_CATALOG[toolId];

                return (
                  <PlannedToolButton
                    icon={tool.icon}
                    key={`${group.id}-${tool.id}-${slotIndex}`}
                    label={home.toolLabels[tool.id]}
                    ariaSuffix={home.plannedAriaSuffix}
                    titleSuffix={home.plannedTitleSuffix}
                    data-home-layout-slot="true"
                  />
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
