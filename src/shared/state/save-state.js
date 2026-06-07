// @ts-check

import { signal } from "../runtime/naf.js";

/**
 * Save state signal.
 *
 * Tracks whether one or more backend save operations are in progress.
 * Used by the titlebar spinner and any other UI that needs to
 * indicate save activity.
 */
const inFlightSaveCount = signal(0, { label: "save.inFlightCount" });

/**
 * Backwards-compatible boolean save signal for UI consumers.
 */
export const saving = signal(false, { label: "save.saving" });

/** @returns {number} */
export function beginSaving() {
  const nextCount = inFlightSaveCount() + 1;
  inFlightSaveCount(nextCount);
  saving(nextCount > 0);
  return nextCount;
}

/** @returns {number} */
export function endSaving() {
  const nextCount = Math.max(0, inFlightSaveCount() - 1);
  inFlightSaveCount(nextCount);
  saving(nextCount > 0);
  return nextCount;
}

/** @returns {number} */
export function getInFlightSaveCount() {
  return inFlightSaveCount();
}
