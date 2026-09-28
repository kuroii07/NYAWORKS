import { describe, expect, it, vi } from "vitest";
import { createNyaPieP0Controller } from "../src/nyaPie/p0/runtimeController";

function createHarness() {
  const runAction = vi.fn(async (actionId: string) => ({
    success: true,
    message: actionId
  }));
  const close = vi.fn();
  const controller = createNyaPieP0Controller({
    deadZone: 20,
    actionIds: {
      top: "p0.direction.top",
      right: "p0.direction.right",
      bottom: "p0.direction.bottom",
      left: "p0.direction.left"
    },
    runAction,
    close
  });
  return { controller, runAction, close };
}

describe("createNyaPieP0Controller", () => {
  it("shows at a center point and tracks the selected direction", () => {
    const { controller } = createHarness();

    controller.show({ x: 100, y: 100 });
    controller.move({ x: 170, y: 100 });

    expect(controller.getState()).toMatchObject({
      visible: true,
      center: { x: 100, y: 100 },
      selectedDirection: "right",
      executing: false
    });
  });

  it("executes the selected action once on release and closes", async () => {
    const { controller, runAction, close } = createHarness();
    controller.show({ x: 100, y: 100 });
    controller.move({ x: 100, y: 30 });

    const first = controller.release();
    const second = controller.release();
    await Promise.all([first, second]);

    expect(runAction).toHaveBeenCalledTimes(1);
    expect(runAction).toHaveBeenCalledWith("p0.direction.top");
    expect(close).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      visible: false,
      selectedDirection: "top",
      executing: false,
      lastResult: {
        success: true,
        message: "p0.direction.top"
      }
    });
  });

  it("closes without executing when release occurs inside the dead zone", async () => {
    const { controller, runAction, close } = createHarness();
    controller.show({ x: 100, y: 100 });

    await controller.release();

    expect(runAction).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the diagnostic runtime visible when the test action fails", async () => {
    const close = vi.fn();
    const controller = createNyaPieP0Controller({
      deadZone: 20,
      actionIds: {
        top: "p0.direction.top",
        right: "p0.direction.right",
        bottom: "p0.direction.bottom",
        left: "p0.direction.left"
      },
      runAction: vi.fn(async () => ({
        success: false,
        message: "After Effects host unavailable",
        error: { code: "host-unavailable" }
      })),
      close
    });
    controller.show({ x: 100, y: 100 });
    controller.move({ x: 100, y: 30 });

    await controller.release();

    expect(close).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({
      visible: true,
      executing: false,
      lastResult: {
        success: false,
        message: "After Effects host unavailable"
      }
    });
  });

  it("cancels with Escape semantics without executing", () => {
    const { controller, runAction, close } = createHarness();
    controller.show({ x: 100, y: 100 });
    controller.move({ x: 40, y: 100 });

    controller.cancel();

    expect(runAction).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(controller.getState().visible).toBe(false);
  });
});
