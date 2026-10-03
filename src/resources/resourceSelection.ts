export interface ResourceSelectionState {
  selectedResourceId: string | null;
  focusedResourceId: string | null;
}

const EMPTY_SELECTION: ResourceSelectionState = {
  selectedResourceId: null,
  focusedResourceId: null
};

function select(resourceId: string): ResourceSelectionState {
  return {
    selectedResourceId: resourceId,
    focusedResourceId: resourceId
  };
}

export function moveResourceSelection(
  state: ResourceSelectionState,
  visibleIds: readonly string[],
  direction: "previous" | "next" | "first" | "last"
): ResourceSelectionState {
  if (visibleIds.length === 0) {
    return EMPTY_SELECTION;
  }

  if (direction === "first") return select(visibleIds[0]);
  if (direction === "last") return select(visibleIds[visibleIds.length - 1]);

  const currentId = state.selectedResourceId ?? state.focusedResourceId;
  const currentIndex = currentId ? visibleIds.indexOf(currentId) : -1;
  if (currentIndex < 0) {
    return select(
      direction === "next" ? visibleIds[0] : visibleIds[visibleIds.length - 1]
    );
  }

  const nextIndex = direction === "next"
    ? Math.min(visibleIds.length - 1, currentIndex + 1)
    : Math.max(0, currentIndex - 1);
  return select(visibleIds[nextIndex]);
}

export function reconcileFilteredSelection(
  state: ResourceSelectionState,
  visibleIds: readonly string[]
): ResourceSelectionState {
  if (
    !state.selectedResourceId ||
    !visibleIds.includes(state.selectedResourceId)
  ) {
    return EMPTY_SELECTION;
  }

  return visibleIds.includes(state.focusedResourceId ?? "")
    ? state
    : select(state.selectedResourceId);
}

export function reconcileRefreshedSelection(
  state: ResourceSelectionState,
  previousVisibleIds: readonly string[],
  nextVisibleIds: readonly string[]
): ResourceSelectionState {
  if (!state.selectedResourceId) {
    return EMPTY_SELECTION;
  }
  if (nextVisibleIds.includes(state.selectedResourceId)) {
    return nextVisibleIds.includes(state.focusedResourceId ?? "")
      ? state
      : select(state.selectedResourceId);
  }
  if (nextVisibleIds.length === 0) {
    return EMPTY_SELECTION;
  }

  const previousIndex = previousVisibleIds.indexOf(state.selectedResourceId);
  const replacementIndex = Math.min(
    previousIndex < 0 ? 0 : previousIndex,
    nextVisibleIds.length - 1
  );
  return select(nextVisibleIds[replacementIndex]);
}
