import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOAST_DURATION,
  addToast,
  dismissToast,
  type ToastRecord
} from "../src/notifications/toastState";

const toast = (id: string, message: string): ToastRecord => ({
  id,
  kind: "error",
  message,
  duration: DEFAULT_TOAST_DURATION
});

describe("global toast state", () => {
  it("keeps only the latest three notifications", () => {
    const state = addToast(addToast(addToast([], toast("1", "一")), toast("2", "二")), toast("3", "三"));

    expect(state).toHaveLength(3);
    expect(addToast(state, toast("4", "四")).map((item) => item.id)).toEqual(["2", "3", "4"]);
  });

  it("does not add an identical notification twice", () => {
    const state = addToast([toast("1", "重复")], toast("2", "重复"));

    expect(state).toHaveLength(1);
    expect(state[0].id).toBe("1");
  });

  it("dismisses only the requested notification", () => {
    const state = [toast("1", "一"), toast("2", "二")];

    expect(dismissToast(state, "1")).toEqual([toast("2", "二")]);
  });

  it("uses a short default duration", () => {
    expect(DEFAULT_TOAST_DURATION).toBe(3000);
  });
});
