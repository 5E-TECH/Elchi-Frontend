const pickText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * POST /orders/rollback/:id javobidagi ogohlantirish (fix3b L1 / CODE-14).
 *
 * `cancelled_sent` ga qaytarishda rollback allaqachon commit bo'ladi, keyin
 * bekor qilinganlar pochtasi yaratiladi. Pochta yaratilmasa backend 500 EMAS,
 * 200 qaytaradi: `{ data: { cancel_post_created: false, warning }, message }` —
 * buyurtma CANCELLED holatida, pochtaga qo'lda qo'shilishi kerak. Bu oddiy
 * muvaffaqiyat emas, shuning uchun foydalanuvchiga ogohlantirish ko'rsatiladi.
 *
 * Qaytaradi: ogohlantirish matni (backend `warning`, bo'lmasa `message`,
 * bo'lmasa `fallback`) yoki `null` — ogohlantirish yo'q, oddiy muvaffaqiyat.
 */
export const getRollbackWarning = (response: unknown, fallback: string): string | null => {
  if (!response || typeof response !== "object") return null;

  const body = response as {
    message?: unknown;
    data?: { cancel_post_created?: unknown; warning?: unknown } | null;
  };
  if (body.data?.cancel_post_created !== false) return null;

  return pickText(body.data?.warning) ?? pickText(body.message) ?? fallback;
};
