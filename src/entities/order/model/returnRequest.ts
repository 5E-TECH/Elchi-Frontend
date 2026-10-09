/**
 * Marketga qaytarish so'rovi — backend `return_requested` / `return_reason`.
 * `return_requested` faqat aniq `true` bo'lsa so'ralgan hisoblanadi.
 */
export interface ReturnRequest {
  requested: boolean;
  reason: string | null;
}

export const readReturnRequest = (order: unknown): ReturnRequest => {
  const source = (order && typeof order === "object" ? order : {}) as {
    return_requested?: unknown;
    return_reason?: unknown;
  };
  const reason = typeof source.return_reason === "string" ? source.return_reason.trim() : "";

  return {
    requested: source.return_requested === true,
    reason: reason || null,
  };
};
