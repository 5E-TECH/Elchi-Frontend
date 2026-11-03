import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../shared/api";
import { api } from "../../shared/api/api";

/**
 * TO'LOVLARNI TUZATISH MUDDATI (T6-FE-3, 2wgTzcG0; backend `docs/frontend/FRONTEND_CHANGELOG.md` 2026-10-30 «T6»,
 * 2026-10-31 AG1Mlikw). Superadmin kuryerdan olingan pulni yoki marketga to'lovni shu muddat ichida qaytaradi yoki
 * summasini tahrirlaydi; muddat zanjirning birinchi to'lovidan `window_days × 24 soat`.
 *  - `GET finance/payment-corrections/settings` (faqat superadmin) → `{ window_days, updated_by, updated_at }`;
 *    qator yo'q yoki yaroqsiz qiymat — 30, qolgan ikkisi `null`. `updated_by` — foydalanuvchi ID (ism emas).
 *  - `PATCH` — `{ window_days }` JSON **son** (1–365, butun); satr («7»), `true`, kasr, 0, 366 → 400 (kodsiz).
 *    Realtime hodisa yo'q, o'zgarish darhol barcha to'lovlarga qo'llanadi — shuning uchun ochiq tafsilot
 *    (`GET finance/history/:id` → `correctable.deadline`) ham qayta o'qiladi.
 *
 * Kalit `cashbox` prefiksida emas: `refreshCashboxQueries` har pul hodisasida sozlamani qayta so'ramasin.
 */

export const PAYMENT_CORRECTION_WINDOW = { min: 1, max: 365, fallback: 30, presets: [7, 10, 30] } as const;
export type PaymentCorrectionPreset = (typeof PAYMENT_CORRECTION_WINDOW.presets)[number];

export type PaymentCorrectionSettings = {
  window_days: number;
  /** O'zgartirgan foydalanuvchi ID'si (ism alohida o'qiladi). */
  updated_by: string | null;
  updated_at: string | null;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

/** `response.data.data` yoki `response.data` — ikkalasi ham. */
const payload = (value: unknown): Record<string, unknown> => {
  const root = record(value);
  return "data" in root && root.data && typeof root.data === "object" ? record(root.data) : root;
};

/** Butun 1…365 — muddat; boshqa har narsa (`"7"` satri ham, backend uni qabul qilmaydi) — `null`. */
export const toPaymentCorrectionWindowDays = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= PAYMENT_CORRECTION_WINDOW.min &&
  value <= PAYMENT_CORRECTION_WINDOW.max
    ? value
    : null;

/**
 * Backend javobi → sozlama. Himoyaviy: noma'lum shakl (boshqa endpointning javobi, `{ items, meta }`) yoki yaroqsiz
 * `window_days` — sukut 30 va «hali hech kim o'zgartirmagan» (backend `parseWindowDays` bilan bir xil).
 */
export const normalizePaymentCorrectionSettings = (value: unknown): PaymentCorrectionSettings => {
  const data = payload(value);
  return {
    window_days: toPaymentCorrectionWindowDays(data.window_days) ?? PAYMENT_CORRECTION_WINDOW.fallback,
    updated_by: text(data.updated_by),
    updated_at: text(data.updated_at),
  };
};

export const paymentCorrectionSettingsKey = ["finance", "payment-correction-settings"] as const;

/** `GET finance/payment-corrections/settings` — sahifa faqat superadmin uchun (route qo'riqchisi). */
export const usePaymentCorrectionSettings = (enabled = true) =>
  useQuery({
    queryKey: paymentCorrectionSettingsKey,
    queryFn: () =>
      api.get(API_ENDPOINTS.FINANCE.PAYMENT_CORRECTION_SETTINGS).then((res) => normalizePaymentCorrectionSettings(res.data)),
    enabled,
    meta: { silentError: true },
  });

/**
 * `PATCH finance/payment-corrections/settings` — `{ window_days }` son bo'lib ketadi (`Number`, satr emas). Muvaffaqiyatda
 * sozlama va ochiq tarix tafsiloti (`["finance-history", id]` — `correctable.deadline`) qayta o'qiladi.
 */
export const useUpdatePaymentCorrectionSettings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (windowDays: number) =>
      api
        .patch(API_ENDPOINTS.FINANCE.PAYMENT_CORRECTION_SETTINGS, { window_days: Number(windowDays) })
        .then((res) => normalizePaymentCorrectionSettings(res.data)),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: paymentCorrectionSettingsKey }),
        // `financeHistory` (index.ts) — bu yerdan import aylana bo'lardi; kalit satri bir xil.
        client.invalidateQueries({ queryKey: ["finance-history"] }),
      ]),
  });
};
