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
  CaretDown,
  Circle,
  CopySimple,
  Cube,
  DiamondsFour,
  Equalizer,
  Eye,
  FolderSimplePlus,
  Folders,
  Lightbulb,
  Link,
  LinkBreak,
  MagicWand,
  MagnifyingGlass,
  Path,
  PencilSimple,
  Plus,
  ProjectorScreen,
  Rectangle,
  SelectionAll,
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
import { useLanguage } from "../i18n/LanguageProvider";
import { useSettings } from "../settings/SettingsProvider";
import type { ToolGroupId, ToolId, UiCopy } from "../i18n/types";

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

const TOOL_GROUPS: readonly {
  id: ToolGroupId;
  tone: "primary" | "secondary";
  tools: readonly { id: ToolId; icon: ToolIcon }[];
}[] = [
  {
    id: "compositionProject",
    tone: "secondary",
    tools: [
      { id: "newProjectFolder", icon: FolderSimplePlus },
      { id: "organizeProject", icon: Folders },
      { id: "duplicateComp", icon: CopySimple },
      { id: "packageLayers", icon: Stack },
      { id: "fitComp", icon: ArrowsOut },
      { id: "findFootage", icon: MagnifyingGlass },
      { id: "removeUnused", icon: Trash }
    ]
  },
  {
    id: "layerActions",
    tone: "primary",
    tools: [
      { id: "duplicateLayer", icon: CopySimple },
      { id: "linkParent", icon: Link },
      { id: "unlinkParent", icon: LinkBreak },
      { id: "moveUp", icon: ArrowUp },
      { id: "moveDown", icon: ArrowDown },
      { id: "reverseOrder", icon: ArrowsLeftRight },
      { id: "soloLayers", icon: Eye }
    ]
  },
  {
    id: "animationTime",
    tone: "secondary",
    tools: [
      { id: "addKeyframe", icon: DiamondsFour },
      { id: "graphEditor", icon: BezierCurve },
      { id: "steppedAnimation", icon: Steps },
      { id: "loopAnimation", icon: ArrowsClockwise },
      { id: "sequenceAnimation", icon: TextAlignLeft },
      { id: "timeOffset", icon: Waveform },
      { id: "easingControl", icon: Equalizer }
    ]
  },
  {
    id: "textShapes",
    tone: "primary",
    tools: [
      { id: "newText", icon: TextT },
      { id: "textLayout", icon: TextAlignLeft },
      { id: "splitText", icon: SelectionAll },
      { id: "rectangle", icon: Rectangle },
      { id: "circle", icon: Circle },
      { id: "star", icon: Star },
      { id: "path", icon: Path }
    ]
  },
  {
    id: "effectsPresets",
    tone: "secondary",
    tools: [
      { id: "effects", icon: MagicWand },
      { id: "adjust", icon: SlidersHorizontal },
      { id: "quickPreset", icon: Sparkle },
      { id: "layerStyles", icon: Stack },
      { id: "linkEffects", icon: Link },
      { id: "audioResponse", icon: Waveform },
      { id: "moreTools", icon: Plus }
    ]
  }
] as const;

function PlannedToolButton({
  icon: Icon,
  label,
  ariaSuffix,
  titleSuffix,
  emphasized = false
}: {
  icon: ToolIcon;
  label: string;
  ariaSuffix: string;
  titleSuffix: string;
  emphasized?: boolean;
}) {
  return (
    <button
      className="tool-button"
      data-emphasized={emphasized || undefined}
      type="button"
      aria-label={`${label}${ariaSuffix}`}
      aria-disabled="true"
      title={`${label}${titleSuffix}`}
    >
      <Icon aria-hidden="true" weight="regular" />
    </button>
  );
}

function AnchorGrid({ copy }: { copy: UiCopy["home"] }) {
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
    <div className="anchor-grid" aria-label={copy.anchorGridAria}>
      {positions.map((position) => (
        <button
          className="anchor-button"
          data-position={position}
          data-selected={position === "center" || undefined}
          key={position}
          type="button"
          aria-label={`${position} ${copy.anchorLabel}${copy.plannedAriaSuffix}`}
          aria-disabled="true"
          title={`${copy.anchorLabel}${copy.plannedTitleSuffix}`}
        >
          <span className="anchor-button__frame" aria-hidden="true">
            <span className="anchor-button__dot" />
          </span>
        </button>
      ))}
    </div>
  );
}

export function HomePage() {
  const { copy } = useLanguage();
  const { generalSettings } = useSettings();
  const home = copy.home;

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
        <h2>{home.shortcutHeading}</h2>
        <button
          type="button"
          aria-label={home.editAria}
          aria-disabled="true"
          title={home.editTitle}
        >
          <PencilSimple aria-hidden="true" />
          {home.edit}
        </button>
      </div>

      <section className="quick-panels" aria-label={home.quickToolsAria}>
        <article className="quick-panel">
          <h3>
            <span aria-hidden="true" />
            {home.createPanelTitle}
          </h3>
          <div className="mode-switch" aria-label={home.createSwitchAria}>
            <span className="mode-switch__active">
              <Stack aria-hidden="true" />
            </span>
            <span>
              <SelectionAll aria-hidden="true" />
            </span>
          </div>
          <div className="create-grid">
            {CREATE_TOOLS.map((tool, index) => (
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
            {home.spacePanelTitle}
          </h3>
          <div className="mode-switch" aria-label={home.anchorSwitchAria}>
            <span className="mode-switch__active">
              <AnchorSimple aria-hidden="true" />
            </span>
            <span>
              <TextAlignLeft aria-hidden="true" />
            </span>
          </div>
          <AnchorGrid copy={home} />
        </article>
      </section>

      <section className="tool-groups" aria-label={home.toolGroupsAria}>
        {TOOL_GROUPS.map((group) => (
          <article className="tool-group" data-tone={group.tone} key={group.id}>
            <h3>
              <span aria-hidden="true" />
              {home.groupTitles[group.id]}
            </h3>
            <div className="tool-group__grid">
              {group.tools.map((tool) => (
                <PlannedToolButton
                  icon={tool.icon}
                  key={tool.id}
                  label={home.toolLabels[tool.id]}
                  ariaSuffix={home.plannedAriaSuffix}
                  titleSuffix={home.plannedTitleSuffix}
                />
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
