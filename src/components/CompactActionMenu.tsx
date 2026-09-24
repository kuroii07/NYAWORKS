import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType
} from "react";
import type { IconProps } from "@phosphor-icons/react";
import { createPortal } from "react-dom";

export interface CompactActionMenuItem {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

interface CompactActionMenuProps {
  ariaLabel: string;
  open: boolean;
  items: readonly CompactActionMenuItem[];
  align?: "left" | "right";
  onClose: () => void;
}

interface CompactActionMenuPositionInput {
  anchorRect: Pick<DOMRect, "left" | "right" | "top" | "bottom">;
  viewportWidth: number;
  viewportHeight: number;
  itemCount: number;
  align?: "left" | "right";
}

interface CompactActionMenuPosition {
  left: number;
  top: number;
  width: number;
  placement: "top" | "bottom";
}

const MENU_WIDTH = 148;
const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;
const MENU_ITEM_HEIGHT = 30;
const MENU_ITEM_GAP = 2;
const MENU_CHROME_HEIGHT = 10;

export function getCompactActionMenuPosition({
  anchorRect,
  viewportWidth,
  viewportHeight,
  itemCount,
  align = "right"
}: CompactActionMenuPositionInput): CompactActionMenuPosition {
  const menuHeight =
    Math.max(0, itemCount) * MENU_ITEM_HEIGHT +
    Math.max(0, itemCount - 1) * MENU_ITEM_GAP +
    MENU_CHROME_HEIGHT;
  const availableBelow = viewportHeight - anchorRect.bottom - VIEWPORT_PADDING;
  const availableAbove = anchorRect.top - VIEWPORT_PADDING;
  const placement =
    availableBelow < menuHeight + MENU_GAP && availableAbove > availableBelow
      ? "top"
      : "bottom";
  const desiredLeft =
    align === "left" ? anchorRect.left : anchorRect.right - MENU_WIDTH;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, desiredLeft),
    viewportWidth - MENU_WIDTH - VIEWPORT_PADDING
  );
  const desiredTop =
    placement === "top"
      ? anchorRect.top - menuHeight - MENU_GAP
      : anchorRect.bottom + MENU_GAP;
  const top = Math.min(
    Math.max(VIEWPORT_PADDING, desiredTop),
    viewportHeight - menuHeight - VIEWPORT_PADDING
  );

  return {
    left,
    top,
    width: MENU_WIDTH,
    placement
  };
}

export function shouldCloseCompactActionMenu(
  menu: Pick<Node, "contains"> | null,
  anchor: Pick<Node, "contains"> | null,
  target: Node
): boolean {
  return !menu?.contains(target) && !anchor?.contains(target);
}

export function CompactActionMenu({
  ariaLabel,
  open,
  items,
  align = "right",
  onClose
}: CompactActionMenuProps) {
  const anchorMarkerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] =
    useState<CompactActionMenuPosition | null>(null);

  function updateMenuPosition() {
    const anchor = anchorMarkerRef.current?.parentElement;

    if (!anchor || typeof window === "undefined") {
      return;
    }

    setMenuPosition(
      getCompactActionMenuPosition({
        anchorRect: anchor.getBoundingClientRect(),
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        itemCount: items.length,
        align
      })
    );
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
  }, [align, items.length, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        shouldCloseCompactActionMenu(
          menuRef.current,
          anchorMarkerRef.current?.parentElement ?? null,
          event.target as Node
        )
      ) {
        onClose();
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleViewportChange() {
      updateMenuPosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [align, items.length, onClose, open]);

  if (!open) {
    return null;
  }

  const menuStyle: CSSProperties | undefined = menuPosition
    ? {
        left: menuPosition.left,
        top: menuPosition.top,
        width: menuPosition.width
      }
    : undefined;
  const menu = (
    <div
      className="compact-action-menu"
      data-align={align}
      data-placement={menuPosition?.placement}
      role="menu"
      aria-label={ariaLabel}
      ref={menuRef}
      style={menuStyle}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            type="button"
            role="menuitem"
            key={item.id}
            disabled={item.disabled}
            data-danger={item.danger || undefined}
            onClick={() => {
              if (!item.disabled) {
                item.onSelect();
                onClose();
              }
            }}
          >
            <Icon aria-hidden="true" weight="regular" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <span
        className="compact-action-menu__anchor-marker"
        aria-hidden="true"
        ref={anchorMarkerRef}
      />
      {typeof document === "undefined"
        ? menu
        : menuPosition
          ? createPortal(menu, document.body)
          : null}
    </>
  );
}
