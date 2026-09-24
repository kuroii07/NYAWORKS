import {
  useEffect,
  useRef,
  type ComponentType
} from "react";
import type { IconProps } from "@phosphor-icons/react";

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

export function CompactActionMenu({
  ariaLabel,
  open,
  items,
  align = "right",
  onClose
}: CompactActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="compact-action-menu"
      data-align={align}
      role="menu"
      aria-label={ariaLabel}
      ref={menuRef}
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
}
