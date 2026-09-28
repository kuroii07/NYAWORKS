import type { ActionResult } from "../../actions/types";
import {
  resolveFourWayDirection,
  type FourWayDirection,
  type Point
} from "./direction";

export interface NyaPieP0State {
  visible: boolean;
  center: Point;
  selectedDirection: FourWayDirection | null;
  executing: boolean;
  lastResult: ActionResult | null;
}

export interface NyaPieP0Controller {
  show(center: Point): void;
  move(point: Point, center?: Point): void;
  release(): Promise<void>;
  cancel(): void;
  getState(): NyaPieP0State;
}

interface ControllerOptions {
  deadZone: number;
  actionIds: Record<FourWayDirection, string>;
  runAction(actionId: string): Promise<ActionResult>;
  close(): void;
  onStateChange?(state: NyaPieP0State): void;
}

export function createNyaPieP0Controller({
  deadZone,
  actionIds,
  runAction,
  close,
  onStateChange
}: ControllerOptions): NyaPieP0Controller {
  let state: NyaPieP0State = {
    visible: false,
    center: { x: 0, y: 0 },
    selectedDirection: null,
    executing: false,
    lastResult: null
  };
  let releasePromise: Promise<void> | null = null;

  function update(next: Partial<NyaPieP0State>) {
    state = { ...state, ...next };
    onStateChange?.(state);
  }

  function finish() {
    update({ visible: false, executing: false });
    close();
  }

  return {
    show(center) {
      releasePromise = null;
      update({
        visible: true,
        center,
        selectedDirection: null,
        executing: false,
        lastResult: null
      });
    },
    move(point, center) {
      if (!state.visible || state.executing) return;
      const activeCenter = center ?? state.center;
      update({
        center: activeCenter,
        selectedDirection: resolveFourWayDirection(
          point,
          activeCenter,
          deadZone
        )
      });
    },
    release() {
      if (releasePromise) return releasePromise;
      if (!state.visible) return Promise.resolve();

      const direction = state.selectedDirection;
      if (!direction) {
        finish();
        return Promise.resolve();
      }

      update({ executing: true });
      releasePromise = runAction(actionIds[direction])
        .then((lastResult) => {
          update({ lastResult });
          if (lastResult.success) {
            finish();
          } else {
            update({ executing: false });
            releasePromise = null;
          }
        })
        .catch((error) => {
          update({
            executing: false,
            lastResult: {
              success: false,
              message: "P0 action failed",
              error: {
                code: "p0-action-error",
                detail: error instanceof Error ? error.message : String(error)
              }
            }
          });
          releasePromise = null;
        });
      return releasePromise;
    },
    cancel() {
      if (!state.visible || state.executing) return;
      finish();
    },
    getState() {
      return state;
    }
  };
}
