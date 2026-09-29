import type { ActionRunner } from "./runner";
import type {
  ActionContextSnapshot,
  ActionResult,
  ActionRunOptions
} from "./types";

export interface ActionContextProvider {
  getSnapshot(): Promise<ActionContextSnapshot>;
}

export interface ActionService {
  run(actionId: string, options?: ActionRunOptions): Promise<ActionResult>;
}

export function createActionService(options: {
  contextProvider: ActionContextProvider;
  runner: ActionRunner;
}): ActionService {
  return {
    async run(actionId, runOptions) {
      let snapshot: ActionContextSnapshot;
      try {
        snapshot = await options.contextProvider.getSnapshot();
      } catch {
        snapshot = {
          hostAvailable: false,
          activeComp: false,
          selectedLayers: 0,
          selectedKeys: 0
        };
      }
      return options.runner.run(actionId, snapshot, runOptions);
    }
  };
}
