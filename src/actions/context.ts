import type {
  ActionAvailability,
  ActionContextSnapshot,
  ActionRequirement,
  NyaActionDefinition
} from "./types";

function requirementIsMet(
  requirement: ActionRequirement,
  context: ActionContextSnapshot
): boolean {
  if (requirement === "host") return context.hostAvailable;
  if (requirement === "activeComp") return context.activeComp;
  if (requirement === "selectedLayers") return context.selectedLayers > 0;
  return context.selectedKeys > 0;
}

export function getActionAvailability(
  definition: NyaActionDefinition,
  context: ActionContextSnapshot
): ActionAvailability {
  const missing = definition.requirements.find(
    (requirement) => !requirementIsMet(requirement, context)
  );

  return missing
    ? { enabled: false, reason: missing }
    : { enabled: true };
}
