type ApiErrorData = { message?: unknown; error?: unknown };

/**
 * Extract a human-facing message from an Axios-style error, preferring the
 * backend's `message` / `error` body field and falling back to a caller-provided
 * (localized) string. Centralizes the scattered `error.response.data.message`
 * casts across the app so error messaging is consistent.
 */
export const getApiErrorMessage = (error: unknown, fallback = ""): string => {
  const data = (error as { response?: { data?: ApiErrorData } } | null | undefined)?.response
    ?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  return fallback;
};
