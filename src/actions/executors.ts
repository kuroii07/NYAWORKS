import {
  isAlignmentAction,
  isAlignmentTarget,
  isLayerAlignmentAction,
  type AlignmentTargetStrategy
} from "./alignmentTypes";
import type { ActionExecutor } from "./types";
import { evaluateHostScript, type CepEnvironment } from "../host/cepBridge";
import {
  createAnchorHostBridge,
  ANCHOR_POSITIONS,
  type AnchorHostBridge
} from "../host/anchorBridge";
import {
  createAlignmentHostBridge,
  type AlignmentHostBridge
} from "../host/alignmentBridge";
import {
  createLayerHostBridge,
  type LayerHostBridge
} from "../host/layerBridge";
import {
  isLayerAction,
  isLayerActionModifier
} from "./layerActionTypes";

export function createInternalExecutor(
  handlers: Readonly<Record<string, ActionExecutor>>
): ActionExecutor {
  return async (definition, context) => {
    const handler = handlers[definition.execute.command];
    if (!handler) {
      return {
        success: false,
        message: "Internal action handler unavailable",
        error: {
          code: "internal-handler-unavailable",
          detail: definition.execute.command
        }
      };
    }
    return handler(definition, context);
  };
}

function encodePayload(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

export function createCepHostExecutor(
  environment?: CepEnvironment,
  anchorBridge: AnchorHostBridge = createAnchorHostBridge(environment),
  alignmentBridge: AlignmentHostBridge = createAlignmentHostBridge(environment),
  layerBridge: LayerHostBridge = createLayerHostBridge(environment)
): ActionExecutor {
  return async (definition, context, runOptions) => {
    if (definition.execute.command === "setAnchorPoint") {
      const position = (definition.execute.payload as { position?: unknown } | undefined)?.position;
      if (typeof position !== "string" || !ANCHOR_POSITIONS.includes(position as never)) {
        return {
          success: false,
          message: "Invalid anchor position",
          error: { code: "invalid-anchor-position" }
        };
      }
      const result = await anchorBridge.setAnchorPoint(position as typeof ANCHOR_POSITIONS[number]);
      if (result.ok) {
        return {
          success: true,
          message: "Anchor point updated",
          data: {
            updatedLayers: result.updatedLayers,
            threeDLayers: result.threeDLayers
          }
        };
      }
      return {
        success: false,
        message: "Anchor action failed",
        error: {
          code: result.reason === "unavailable"
            ? "host-unavailable"
            : result.reason,
          detail: result.detail
        }
      };
    }

    if (definition.execute.command === "setAlignment") {
      const payload = definition.execute.payload as {
        action?: unknown;
        target?: unknown;
      } | undefined;
      if (!isAlignmentAction(payload?.action)) {
        return {
          success: false,
          message: "Invalid alignment action",
          error: { code: "invalid-alignment-action" }
        };
      }

      let target: "composition" | "selection" = "composition";
      if (isLayerAlignmentAction(payload.action)) {
        if (
          payload.target !== "smart" &&
          !isAlignmentTarget(payload.target)
        ) {
          return {
            success: false,
            message: "Invalid alignment target",
            error: { code: "invalid-alignment-target" }
          };
        }
        if (
          runOptions?.alignmentTarget !== undefined &&
          !isAlignmentTarget(runOptions.alignmentTarget)
        ) {
          return {
            success: false,
            message: "Invalid alignment target",
            error: { code: "invalid-alignment-target" }
          };
        }
        const strategy: AlignmentTargetStrategy = payload.target;
        target = runOptions?.alignmentTarget ??
          (strategy === "smart"
            ? context.selectedLayers > 1 ? "selection" : "composition"
            : strategy);
      }

      const result = await alignmentBridge.applyAlignment(
        payload.action,
        target
      );
      if (result.ok) {
        return {
          success: true,
          message: "Alignment updated",
          data: { updatedLayers: result.updatedLayers }
        };
      }
      return {
        success: false,
        message: "Alignment action failed",
        error: {
          code: result.reason === "unavailable"
            ? "host-unavailable"
            : result.reason,
          detail: result.detail
        }
      };
    }

    if (definition.execute.command === "runLayerAction") {
      const action = (definition.execute.payload as { action?: unknown } | undefined)?.action;
      if (!isLayerAction(action)) {
        return {
          success: false,
          message: "Invalid layer action",
          error: { code: "invalid-layer-action" }
        };
      }

      const modifier = runOptions?.layerModifier ?? "none";
      if (!isLayerActionModifier(modifier)) {
        return {
          success: false,
          message: "Invalid layer action modifier",
          error: { code: "invalid-layer-modifier" }
        };
      }

      const result = await layerBridge.runLayerAction(
        action,
        modifier
      );
      if (result.ok) {
        return {
          success: true,
          message: "Layer action completed",
          data: {
            createdLayers: result.createdLayers,
            updatedLayers: result.updatedLayers,
            createdItems: result.createdItems
          }
        };
      }
      return {
        success: false,
        message: "Layer action failed",
        error: {
          code: result.reason === "unavailable"
            ? "host-unavailable"
            : result.reason,
          detail: result.detail
        }
      };
    }

    if (definition.execute.command !== "runP0TestAction") {
      return {
        success: false,
        message: "Unsupported P0 host command",
        error: {
          code: "unsupported-host-command",
          detail: definition.execute.command
        }
      };
    }

    const result = await evaluateHostScript(
      `NYAWORKS.runP0TestAction("${encodePayload({
        actionId: definition.id
      })}")`,
      environment
    );

    if (result === null) {
      return {
        success: false,
        message: "After Effects host unavailable",
        error: {
          code: "host-unavailable"
        }
      };
    }

    try {
      const parsed = JSON.parse(result) as {
        ok?: unknown;
        message?: unknown;
        data?: unknown;
        reason?: unknown;
        detail?: unknown;
      };

      if (parsed.ok === true) {
        return {
          success: true,
          message:
            typeof parsed.message === "string"
              ? parsed.message
              : "P0 action received",
          data: parsed.data
        };
      }

      return {
        success: false,
        message:
          typeof parsed.message === "string"
            ? parsed.message
            : "P0 host action failed",
        error: {
          code:
            typeof parsed.reason === "string"
              ? parsed.reason
              : "host-error",
          detail:
            typeof parsed.detail === "string" ? parsed.detail : undefined
        }
      };
    } catch {
      return {
        success: false,
        message: "Invalid P0 host response",
        error: {
          code: "invalid-host-response"
        }
      };
    }
  };
}
