// @ts-check

import { GetHistoryState, Redo, Undo } from "../../shared/api/api.js";
import { getErrorMessage } from "../../shared/infra/errors.js";
import { appState } from "../../shared/state/app-state.js";
import { treeState } from "../state/tree/tree-state.js";
import { uiState } from "../../shared/state/ui-state.js";

/**
 * @param {"undo" | "redo"} direction
 * @returns {Promise<void>}
 */
export async function runHistoryAction(direction) {
  if (!appState.selectors.getCurrentFilePath()) {
    return;
  }

  const historyState = await GetHistoryState();
  const canRun = direction === "undo" ? historyState.canUndo : historyState.canRedo;
  const actionLabel = direction === "undo" ? historyState.undoLabel : historyState.redoLabel;
  if (!canRun) {
    return;
  }

  const selectionSnapshot = treeState.selectors.captureSelectionSnapshot();
  try {
    if (direction === "undo") {
      await Undo();
    } else {
      await Redo();
    }
    await treeState.actions.refresh();
    treeState.actions.restoreSelectionSnapshot(selectionSnapshot);
    uiState.actions.showToast(
      `${direction === "undo" ? "Undid" : "Redid"} ${actionLabel || "action"}`,
      "success",
    );
  } catch (caughtError) {
    uiState.actions.showToast(
      getErrorMessage(caughtError, `Failed to ${direction}`),
      "error",
    );
  }
}
