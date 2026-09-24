import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent
} from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { createPortal } from "react-dom";

type SettingSelectValue = string | number;

export interface SettingSelectOption<T extends SettingSelectValue> {
  value: T;
  label: string;
}

interface SettingSelectProps<T extends SettingSelectValue> {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  options: readonly SettingSelectOption<T>[];
  title?: string;
  value: T;
  onChange: (value: T) => void;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;
const OPTION_HEIGHT = 32;
const MENU_PADDING = 8;
const MAX_MENU_HEIGHT = 320;

export function SettingSelect<T extends SettingSelectValue>({
  ariaLabel,
  className = "",
  disabled = false,
  options,
  title,
  value,
  onChange
}: SettingSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => Object.is(option.value, value))
  );
  const selectedOption = options[selectedIndex] ?? options[0];
  const rootClassName = ["setting-select", className]
    .filter(Boolean)
    .join(" ");

  const menuStyle = useMemo<CSSProperties | undefined>(() => {
    if (!menuPosition) {
      return undefined;
    }

    return {
      left: menuPosition.left,
      top: menuPosition.top,
      width: menuPosition.width,
      maxHeight: menuPosition.maxHeight
    };
  }, [menuPosition]);

  function updateMenuPosition() {
    const trigger = triggerRef.current;

    if (!trigger || typeof window === "undefined") {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const estimatedHeight = Math.min(
      options.length * OPTION_HEIGHT + MENU_PADDING,
      MAX_MENU_HEIGHT,
      viewportHeight - VIEWPORT_PADDING * 2
    );
    const spaceBelow = viewportHeight - rect.bottom;
    const placement =
      spaceBelow < estimatedHeight + MENU_GAP && rect.top > spaceBelow
        ? "top"
        : "bottom";
    const width = rect.width;
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.left),
      viewportWidth - width - VIEWPORT_PADDING
    );
    const top =
      placement === "top"
        ? Math.max(VIEWPORT_PADDING, rect.top - estimatedHeight - MENU_GAP)
        : Math.min(
            rect.bottom + MENU_GAP,
            viewportHeight - estimatedHeight - VIEWPORT_PADDING
          );

    setMenuPosition({
      left,
      top,
      width,
      maxHeight: Math.min(MAX_MENU_HEIGHT, viewportHeight - VIEWPORT_PADDING * 2),
      placement
    });
  }

  function openMenu(index = selectedIndex) {
    if (disabled || options.length === 0) {
      return;
    }

    setActiveIndex(index);
    updateMenuPosition();
    setIsOpen(true);
  }

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function selectOption(index: number) {
    const option = options[index];

    if (!option) {
      return;
    }

    onChange(option.value);
    closeMenu(true);
  }

  function moveActiveOption(direction: 1 | -1) {
    if (options.length === 0) {
      return;
    }

    setActiveIndex((current) => {
      const next = (current + direction + options.length) % options.length;
      return next;
    });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(options.length - 1);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveOption(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveOption(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu();
    }
  }

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, options.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-option-index="${activeIndex}"]`
        )
        ?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, isOpen]);

  return (
    <>
      <button
        className={rootClassName}
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        title={title}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="setting-select__value">{selectedOption?.label}</span>
        <CaretDown
          className="setting-select__caret"
          aria-hidden="true"
          weight="bold"
        />
      </button>

      {isOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              className="setting-select-popover"
              data-placement={menuPosition.placement}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              ref={menuRef}
              style={menuStyle}
            >
              {options.map((option, index) => {
                const isSelected = Object.is(option.value, value);
                const isActive = index === activeIndex;

                return (
                  <button
                    className="setting-select-option"
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive || undefined}
                    data-selected={isSelected || undefined}
                    data-option-index={index}
                    key={String(option.value)}
                    tabIndex={isActive ? 0 : -1}
                    onPointerMove={() => setActiveIndex(index)}
                    onClick={() => selectOption(index)}
                    onKeyDown={handleOptionKeyDown}
                  >
                    <span>{option.label}</span>
                    <Check aria-hidden="true" weight="bold" />
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
