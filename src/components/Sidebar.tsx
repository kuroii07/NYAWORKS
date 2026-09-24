import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  BezierCurve,
  FolderSimple,
  House,
  ImageSquare,
  MagicWand,
  ProjectorScreen,
  Shapes,
  Sparkle,
  Stack,
  TextT
} from "@phosphor-icons/react";
import { useLanguage } from "../i18n/LanguageProvider";
import type { PageId } from "../types/navigation";

type SidebarPageId = Exclude<PageId, "settings">;

interface NavItem {
  id: SidebarPageId;
  icon: ComponentType<IconProps>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", icon: House },
  { id: "ai", icon: Sparkle },
  { id: "projects", icon: FolderSimple },
  { id: "compositions", icon: ProjectorScreen },
  { id: "layers", icon: Stack },
  { id: "animation", icon: BezierCurve },
  { id: "text", icon: TextT },
  { id: "shapes", icon: Shapes },
  { id: "effects", icon: MagicWand },
  { id: "media", icon: ImageSquare }
];

interface SidebarProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
}

export function Sidebar({ activePage, onPageChange }: SidebarProps) {
  const { copy } = useLanguage();

  return (
    <nav className="sidebar" aria-label={copy.navigationAria}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activePage;
        const label = copy.navigation[item.id];

        return (
          <button
            className="nav-item"
            data-active={isActive}
            key={item.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            title={label}
            onClick={() => onPageChange(item.id)}
          >
            <Icon aria-hidden="true" weight="regular" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
