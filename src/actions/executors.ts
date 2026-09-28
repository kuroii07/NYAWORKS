import type { ActionExecutor } from "./types";
import { evaluateHostScript, type CepEnvironment } from "../host/cepBridge";

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
  environment?: CepEnvironment
): ActionExecutor {
  return async (definition) => {
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
