import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { useSettings } from "../settings/SettingsProvider";
import { resolveTooltipTitle } from "./tooltipTitle";

interface TooltipState {
  text: string;
  left: number;
  top: number;
}

const TOOLTIP_ATTRIBUTE = "data-nyaworks-tooltip";

function findTooltipTarget(value: EventTarget | null): HTMLElement | null {
  return value instanceof Element
    ? value.closest<HTMLElement>(`[title], [${TOOLTIP_ATTRIBUTE}]`)
    : null;
}

export function GlobalTooltip() {
  const { languageId } = useLanguage();
  const { generalSettings } = useSettings();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const activeTarget = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    function clearTimer() {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    }

    function restoreTitle(target: HTMLElement | null) {
      if (!target) {
        return;
      }

      const restoredTitle = resolveTooltipTitle(
        target.getAttribute("title"),
        target.getAttribute(TOOLTIP_ATTRIBUTE)
      );
      if (restoredTitle) {
        target.setAttribute("title", restoredTitle);
      }
      target.removeAttribute(TOOLTIP_ATTRIBUTE);
    }

    function hideTooltip() {
      clearTimer();
      restoreTitle(activeTarget.current);
      activeTarget.current = null;
      setTooltip(null);
    }

    function showForTarget(target: HTMLElement) {
      if (target === activeTarget.current) {
        return;
      }

      hideTooltip();

      const title =
        target.getAttribute("title") ??
        target.getAttribute(TOOLTIP_ATTRIBUTE);
      if (!title) {
        return;
      }

      target.setAttribute(TOOLTIP_ATTRIBUTE, title);
      target.removeAttribute("title");
      activeTarget.current = target;

      if (!generalSettings.tooltipsEnabled) {
        return;
      }

      timer.current = window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const halfWidth = 96;
        const left = Math.min(
          window.innerWidth - halfWidth - 8,
          Math.max(halfWidth + 8, rect.left + rect.width / 2)
        );
        const top = Math.min(window.innerHeight - 44, rect.bottom + 8);
        setTooltip({ text: title, left, top });
      }, generalSettings.tooltipDelayMs);
    }

    function handlePointerOver(event: PointerEvent) {
      const target = findTooltipTarget(event.target);
      if (target) {
        showForTarget(target);
      }
    }

    function handlePointerOut(event: PointerEvent) {
      const target = activeTarget.current;
      if (!target) {
        return;
      }

      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) {
        return;
      }

      hideTooltip();
    }

    function handleFocusIn(event: FocusEvent) {
      const target = findTooltipTarget(event.target);
      if (target) {
        showForTarget(target);
      }
    }

    function handleFocusOut(event: FocusEvent) {
      const target = activeTarget.current;
      const related = event.relatedTarget;
      if (
        target &&
        related instanceof Node &&
        target.contains(related)
      ) {
        return;
      }

      hideTooltip();
    }

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      clearTimer();
      restoreTitle(activeTarget.current);
    };
  }, [
    generalSettings.tooltipDelayMs,
    generalSettings.tooltipsEnabled,
    languageId
  ]);

  return tooltip ? (
    <div
      className="global-tooltip"
      role="tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      {tooltip.text}
    </div>
  ) : null;
}
