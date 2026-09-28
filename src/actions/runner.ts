import { getActionAvailability } from "./context";
import type { ActionRegistry } from "./registry";
import type {
  ActionContextSnapshot,
  ActionExecutor,
  ActionResult,
  ActionExecutionDescriptor
} from "./types";

type ExecutorMap = Partial<
  Record<ActionExecutionDescriptor["type"], ActionExecutor>
>;

export interface ActionRunner {
  run(
    actionId: string,
    context: ActionContextSnapshot
  ): Promise<ActionResult>;
}

export function createActionRunner({
  registry,
  executors
}: {
  registry: ActionRegistry;
  executors: ExecutorMap;
}): ActionRunner {
  return {
    async run(actionId, context) {
      const definition = registry.get(actionId);
      if (!definition) {
        return {
          success: false,
          message: `Unknown action: ${actionId}`,
          error: { code: "unknown-action" }
        };
      }

      const availability = getActionAvailability(definition, context);
      if (!availability.enabled) {
        return {
          success: false,
          message: `Action unavailable: ${availability.reason}`,
          error: {
            code: "action-unavailable",
            detail: availability.reason
          }
        };
      }

      const executor = executors[definition.execute.type];
      if (!executor) {
        return {
          success: false,
          message: "Action executor unavailable",
          error: {
            code: "executor-unavailable",
            detail: definition.execute.type
          }
        };
      }

      try {
        return await executor(definition, context);
      } catch (error) {
        return {
          success: false,
          message: "Action execution failed",
          error: {
            code: "executor-error",
            detail: error instanceof Error ? error.message : String(error)
          }
        };
      }
    }
  };
}
