import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent
} from "react";
import { ArrowsClockwise, Check } from "@phosphor-icons/react";
import { createPortal } from "react-dom";

interface ModelComboBoxProps {
  ariaLabel: string;
  value: string;
  options: readonly string[];
  refreshLabel: string;
  placeholder: string;
  loading: boolean;
  error?: string | null;
  defaultOpen?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onRefresh: () => void;
}

interface PopoverPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

const VIEWPORT_PADDING = 8;
const POPOVER_GAP = 5;
const MAX_POPOVER_HEIGHT = 210;

export function ModelComboBox({
  ariaLabel,
  value,
  options,
  refreshLabel,
  placeholder,
  loading,
  error,
  defaultOpen = false,
  disabled = false,
  onChange,
  onRefresh
}: ModelComboBoxProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const uniqueOptions = Array.from(
    new Set(options.map((option) => option.trim()).filter(Boolean))
  );

  function updatePosition() {
    const root = rootRef.current;

    if (!root || typeof document === "undefined") {
      return;
    }

    const rect = root.getBoundingClientRect();
    const viewportHeight = document.documentElement.clientHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const desiredHeight = Math.min(
      MAX_POPOVER_HEIGHT,
      Math.max(40, uniqueOptions.length * 30 + 8)
    );
    const below = viewportHeight - rect.bottom - VIEWPORT_PADDING;
    const above = rect.top - VIEWPORT_PADDING;
    const placement =
      below < desiredHeight + POPOVER_GAP && above > below ? "top" : "bottom";
    const width = Math.min(
      rect.width,
      Math.max(0, viewportWidth - VIEWPORT_PADDING * 2)
    );
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.left),
      Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING)
    );
    const maxHeight = Math.min(
      MAX_POPOVER_HEIGHT,
      placement === "top" ? above - POPOVER_GAP : below - POPOVER_GAP
    );
    const top =
      placement === "top"
        ? Math.max(VIEWPORT_PADDING, rect.top - Math.min(desiredHeight, maxHeight) - POPOVER_GAP)
        : rect.bottom + POPOVER_GAP;

    setPosition({
      left,
      top,
      width,
      maxHeight: Math.max(40, maxHeight),
      placement
    });
  }

  function openOptions() {
    if (disabled || uniqueOptions.length === 0) {
      return;
    }

    const selectedIndex = uniqueOptions.indexOf(value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    updatePosition();
    setIsOpen(true);
  }

  function closeOptions(restoreFocus = false) {
    setIsOpen(false);

    if (restoreFocus && typeof window !== "undefined") {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function selectOption(index: number) {
    const option = uniqueOptions[index];

    if (!option) {
      return;
    }

    onChange(option);
    closeOptions(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openOptions();
      } else {
        setActiveIndex((current) => (current + 1) % uniqueOptions.length);
      }
    } else if (event.key === "ArrowUp" && uniqueOptions.length > 0) {
      event.preventDefault();
      if (!isOpen) {
        openOptions();
      } else {
        setActiveIndex(
          (current) => (current - 1 + uniqueOptions.length) % uniqueOptions.length
        );
      }
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      selectOption(activeIndex);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeOptions(true);
    }
  }

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, uniqueOptions.length]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        closeOptions();
      }
    }

    function handleViewportChange() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  const menuStyle: CSSProperties | undefined = position
    ? {
        left: position.left,
        top: position.top,
        width: position.width,
        maxHeight: position.maxHeight
      }
    : undefined;
  const menu = (
    <div
      className="model-combobox__popover"
      data-placement={position?.placement}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel}
      ref={popoverRef}
      style={menuStyle}
    >
      {uniqueOptions.map((option, index) => (
        <button
          type="button"
          role="option"
          aria-selected={option === value}
          data-active={index === activeIndex || undefined}
          key={option}
          onPointerMove={() => setActiveIndex(index)}
          onClick={() => selectOption(index)}
        >
          <span>{option}</span>
          <Check aria-hidden="true" weight="bold" />
        </button>
      ))}
    </div>
  );

  return (
    <div className="model-combobox-field">
      <div
        className="model-combobox"
        data-loading={loading || undefined}
        ref={rootRef}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-autocomplete="list"
          aria-busy={loading || undefined}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={openOptions}
          onClick={openOptions}
          onChange={(event) => {
            onChange(event.target.value);
            if (uniqueOptions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          aria-label={refreshLabel}
          title={refreshLabel}
          disabled={disabled || loading}
          onClick={onRefresh}
        >
          <ArrowsClockwise aria-hidden="true" weight="bold" />
        </button>
      </div>
      {error ? (
        <span className="model-combobox__feedback" role="status">
          {error}
        </span>
      ) : null}
      {isOpen && uniqueOptions.length > 0
        ? typeof document === "undefined"
          ? menu
          : position
            ? createPortal(menu, document.body)
            : null
        : null}
    </div>
  );
}
