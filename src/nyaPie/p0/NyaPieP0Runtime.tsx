import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionResult } from "../../actions/types";
import {
  createNyaPieP0Controller,
  type NyaPieP0State
} from "./runtimeController";
import type { FourWayDirection } from "./direction";
import {
  NYA_PIE_P1_RUNTIME_TITLE,
  type CepKeyInterest
} from "./cepLauncher";

const ACTION_IDS: Record<FourWayDirection, string> = {
  top: "p0.direction.top",
  right: "p0.direction.right",
  bottom: "p0.direction.bottom",
  left: "p0.direction.left"
};

const SLOT_LABELS: Record<FourWayDirection, string> = {
  top: "A",
  right: "B",
  bottom: "C",
  left: "D"
};

const INITIAL_STATE: NyaPieP0State = {
  visible: false,
  center: { x: 0, y: 0 },
  selectedDirection: null,
  executing: false,
  lastResult: null
};

interface NyaPieP0RuntimeProps {
  runAction(actionId: string): Promise<ActionResult>;
  closeRuntime(): void;
  setWindowTitle(title: string): boolean;
  registerFocusedKeyInterest(keys: readonly CepKeyInterest[]): boolean;
}

export function NyaPieP0Runtime({
  runAction,
  closeRuntime,
  setWindowTitle,
  registerFocusedKeyInterest
}: NyaPieP0RuntimeProps) {
  const [state, setState] = useState<NyaPieP0State>(INITIAL_STATE);
  const titleApplied = useRef(false);
  const controller = useMemo(
    () =>
      createNyaPieP0Controller({
        deadZone: 28,
        actionIds: ACTION_IDS,
        runAction,
        close: closeRuntime,
        onStateChange: setState
      }),
    [closeRuntime, runAction]
  );

  useEffect(() => {
    if (!titleApplied.current) {
      titleApplied.current = true;
      setWindowTitle(NYA_PIE_P1_RUNTIME_TITLE);
    }
    registerFocusedKeyInterest([
      { keyCode: 27 },
      { keyCode: 123 },
      { keyCode: 32, altKey: true },
      { keyCode: 18 }
    ]);
    controller.show({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        controller.cancel();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const isF12 =
        event.key === "F12" ||
        event.code === "F12" ||
        event.keyCode === 123;
      const isAltSpaceRelease =
        event.key === "Alt" ||
        event.code === "AltLeft" ||
        event.code === "AltRight" ||
        event.keyCode === 18 ||
        event.key === " " ||
        event.key === "Spacebar" ||
        event.code === "Space" ||
        event.keyCode === 32;
      if (isF12 || isAltSpaceRelease) {
        event.preventDefault();
        void controller.release();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [controller, registerFocusedKeyInterest, setWindowTitle]);

  return (
    <main
      className="nya-pie-p0"
      data-visible={state.visible}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const center =
          rect.width > 0 && rect.height > 0
            ? {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
              }
            : {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
              };
        controller.move(
          { x: event.clientX, y: event.clientY },
          center
        );
      }}
    >
      <div className="nya-pie-p0__diagnostic">
        <strong>Nya Pie P0</strong>
        <span>
          {state.executing ? "Executing" : "Release Alt+Space · Esc closes"}
        </span>
      </div>
      {(Object.keys(ACTION_IDS) as FourWayDirection[]).map((direction) => (
        <button
          aria-label={direction}
          className="nya-pie-p0__slot"
          data-active={state.selectedDirection === direction}
          data-direction={direction}
          key={direction}
          type="button"
          onClick={(event) => {
            const rect = event.currentTarget
              .closest(".nya-pie-p0")
              ?.getBoundingClientRect();
            if (!rect) return;
            const offsets: Record<FourWayDirection, [number, number]> = {
              top: [0, -80],
              right: [80, 0],
              bottom: [0, 80],
              left: [-80, 0]
            };
            const [x, y] = offsets[direction];
            controller.move(
              {
                x: rect.left + rect.width / 2 + x,
                y: rect.top + rect.height / 2 + y
              },
              {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
              }
            );
          }}
        >
          {SLOT_LABELS[direction]}
        </button>
      ))}
      <div className="nya-pie-p0__center" aria-hidden="true" />
      <output className="nya-pie-p0__status" aria-live="polite">
        {state.lastResult?.message ??
          state.selectedDirection ??
          "Move pointer outside dead zone"}
      </output>
    </main>
  );
}
