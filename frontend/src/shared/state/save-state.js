// @ts-check

import { signal } from "../runtime/naf.js";

/**
 * Save state signal.
 *
 * Tracks whether a backend save operation is in progress.
 * Used by the titlebar spinner and any other UI that needs to
 * indicate save activity.
 */
export const saving = signal(false);
