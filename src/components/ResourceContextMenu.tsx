import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { createPortal } from "react-dom";
import type {
  ResourceCommandFailureReason,
  ResourceCommandId,
  ResourceCommandItem
} from "../resources/resourceCommands";

export type ResourceMenuAnchor =
  | { kind: "point"; x: number; y: number }
  | { kind: "element"; element: HTMLElement };

interface ResourceContextMenuPositionInput {
  anchor: ResourceMenuAnchor;
  viewportWidth: number;
  viewportHeight: number;
  menuWidth: number;
  menuHeight: number;
}

interface ResourceContextMenuPosition {
  left: number;
  top: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

export interface ResourceContextMenuProps {
  open: boolean;
  ariaLabel: string;
  anchor: ResourceMenuAnchor | null;
  restoreFocusTo: HTMLElement | null;
  items: readonly ResourceCommandItem[];
  getLabel(item: ResourceCommandItem): string;
  getDisabledReason(reason: ResourceCommandFailureReason): string;
  onSelect(commandId: ResourceCommandId): void;
  onClose(): void;
}

const VIEWPORT_PADDING = 8;
const ELEMENT_GAP = 6;
const MENU_WIDTH = 236;

export function getResourceContextMenuPosition({
  anchor,
  viewportWidth,
  viewportHeight,
  menuWidth,
  menuHeight
}: ResourceContextMenuPositionInput): ResourceContextMenuPosition {
  const maxHeight = Math.max(0, viewportHeight - VIEWPORT_PADDING * 2);
  const visibleHeight = Math.min(menuHeight, maxHeight);
  const rect = anchor.kind === "element"
    ? anchor.element.getBoundingClientRect()
    : null;
  const desiredLeft = anchor.kind === "point" ? anchor.x : rect?.left ?? 0;
  const belowTop = anchor.kind === "point"
    ? anchor.y
    : (rect?.bottom ?? 0) + ELEMENT_GAP;
  const aboveTop = anchor.kind === "point"
    ? anchor.y - visibleHeight
    : (rect?.top ?? 0) - ELEMENT_GAP - visibleHeight;
  const fitsBelow = belowTop + visibleHeight <= viewportHeight - VIEWPORT_PADDING;
  const placement = fitsBelow ? "bottom" : "top";
  const desiredTop = placement === "bottom" ? belowTop : aboveTop;
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - menuWidth - VIEWPORT_PADDING);
  const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - visibleHeight - VIEWPORT_PADDING);

  return {
    left: Math.min(Math.max(VIEWPORT_PADDING, desiredLeft), maxLeft),
    top: Math.min(Math.max(VIEWPORT_PADDING, desiredTop), maxTop),
    maxHeight,
    placement
  };
}

function separatorCount(items: readonly ResourceCommandItem[]): number {
  let count = 0;
  for (let index = 1; index < items.length; index += 1) {
    if (items[index - 1].group !== items[index].group) count += 1;
  }
  return count;
}

export function ResourceContextMenu({
  open,
  ariaLabel,
  anchor,
  restoreFocusTo,
  items,
  getLabel,
  getDisabledReason,
  onSelect,
  onClose
}: ResourceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const enabledIndexes = useMemo(
    () => items.flatMap((item, index) => item.enabled ? [index] : []),
    [items]
  );
  const [activeIndex, setActiveIndex] = useState(enabledIndexes[0] ?? -1);
  const [position, setPosition] = useState<ResourceContextMenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const estimatedHeight = items.length * 32 + separatorCount(items) * 9 + 8;
    setPosition(getResourceContextMenuPosition({
      anchor,
      viewportWidth,
      viewportHeight,
      menuWidth: MENU_WIDTH,
      menuHeight: estimatedHeight
    }));
  }, [anchor, items, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const firstIndex = enabledIndexes[0] ?? -1;
    setActiveIndex(firstIndex);
    if (firstIndex >= 0) {
      itemRefs.current.get(firstIndex)?.focus();
    }
  }, [enabledIndexes, open]);

  useLayoutEffect(() => {
    if (open && activeIndex >= 0) {
      itemRefs.current.get(activeIndex)?.focus();
    }
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleViewportChange() {
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [onClose, open]);

  if (!open || !anchor || typeof document === "undefined") {
    return null;
  }

  function closeAndRestoreFocus() {
    onClose();
    restoreFocusTo?.focus();
  }

  function moveActive(direction: "next" | "previous" | "first" | "last") {
    if (enabledIndexes.length === 0) return;
    if (direction === "first") {
      setActiveIndex(enabledIndexes[0]);
      return;
    }
    if (direction === "last") {
      setActiveIndex(enabledIndexes[enabledIndexes.length - 1]);
      return;
    }
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const fallback = direction === "next" ? -1 : 0;
    const normalizedPosition = currentPosition < 0 ? fallback : currentPosition;
    const offset = direction === "next" ? 1 : -1;
    const nextPosition =
      (normalizedPosition + offset + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition]);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      onClose();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveActive(event.key === "ArrowDown" ? "next" : "previous");
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      moveActive(event.key === "Home" ? "first" : "last");
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      const item = items[activeIndex];
      if (item?.enabled) {
        onSelect(item.id);
        onClose();
      }
    }
  }

  const style: CSSProperties = position
    ? {
        left: position.left,
        top: position.top,
        width: MENU_WIDTH,
        maxHeight: position.maxHeight
      }
    : { visibility: "hidden" };

  return createPortal(
    <div
      className="resource-context-menu"
      role="menu"
      aria-label={ariaLabel}
      data-placement={position?.placement}
      ref={menuRef}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => {
        const showSeparator =
          index > 0 && items[index - 1].group !== item.group;
        const reason = item.disabledReason
          ? getDisabledReason(item.disabledReason)
          : null;
        return (
          <div className="resource-context-menu__entry" key={item.id}>
            {showSeparator ? <div role="separator" /> : null}
            <button
              type="button"
              role="menuitem"
              aria-disabled={!item.enabled || undefined}
              tabIndex={item.enabled && activeIndex === index ? 0 : -1}
              ref={(element) => {
                if (element) itemRefs.current.set(index, element);
                else itemRefs.current.delete(index);
              }}
              onFocus={() => {
                if (item.enabled) setActiveIndex(index);
              }}
              onClick={() => {
                if (!item.enabled) return;
                onSelect(item.id);
                onClose();
              }}
            >
              <span className="resource-context-menu__label">{getLabel(item)}</span>
              {item.shortcut ? (
                <kbd className="resource-context-menu__shortcut">{item.shortcut}</kbd>
              ) : null}
              {reason ? (
                <small className="resource-context-menu__reason">{reason}</small>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
