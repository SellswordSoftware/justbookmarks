// @ts-check

/**
 * Normalize unknown errors into a user-facing string.
 *
 * @param {unknown} error
 * @param {string} [fallback="Unexpected error"]
 * @returns {string}
 */
export function getErrorMessage(error, fallback = "Unexpected error") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}
