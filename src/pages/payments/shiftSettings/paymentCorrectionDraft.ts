import { useCallback, useState } from "react";
import {
  PAYMENT_CORRECTION_WINDOW,
  usePaymentCorrectionSettings,
  useUpdatePaymentCorrectionSettings,
  type PaymentCorrectionPreset,
} from "../../../entities/payments";

/**
 * «To'lovlarni tuzatish muddati» qoralamasi (T6-FE-3, 2wgTzcG0) — sahifa darajasida (`useReceiptSettingsDraft` naqshi):
 * smena sozlamalari saqlanganda forma qayta quriladi, muddat so'rovi yiqilsa ham kiritilgan qiymat yo'qolmasin.
 * Server qiymati 7/10/30 bo'lsa — tayyor variant, aks holda «Boshqa» + son. `dirty` — son serverdagidan farq qiladi;
 * `invalid` — «Boshqa» da 1–365 butun son emas («Saqlash» o'chiq). Sozlama o'qilmagan bo'lsa ikkalasi `false`.
 */

type CorrectionEdit = { mode: "preset"; days: PaymentCorrectionPreset } | { mode: "custom"; text: string };
export type SegmentValue = `${PaymentCorrectionPreset}` | "custom";

export const CUSTOM = "custom" as const;

const isPreset = (days: number): days is PaymentCorrectionPreset =>
  (PAYMENT_CORRECTION_WINDOW.presets as readonly number[]).includes(days);

const fromDays = (days: number): CorrectionEdit =>
  isPreset(days) ? { mode: "preset", days } : { mode: "custom", text: String(days) };

/** «Kunlar soni» matni → butun 1…365, aks holda `null` (bo'sh, `0`, `400`). */
const parseCorrectionDays = (text: string): number | null => {
  if (!/^\d+$/.test(text)) return null;
  const days = Number(text);
  return days >= PAYMENT_CORRECTION_WINDOW.min && days <= PAYMENT_CORRECTION_WINDOW.max ? days : null;
};

export const usePaymentCorrectionDraft = () => {
  const query = usePaymentCorrectionSettings();
  const update = useUpdatePaymentCorrectionSettings();
  const { mutateAsync } = update;
  const [edit, setEdit] = useState<CorrectionEdit | null>(null);
  const base = query.data ?? null;
  const value = edit ?? (base ? fromDays(base.window_days) : null);
  const days = value ? (value.mode === "preset" ? value.days : parseCorrectionDays(value.text)) : null;
  // Sozlama o'qilmagan bo'lsa (yuklanmoqda / xato) — karta tahrirlanmaydi, sahifaning qolgani saqlanaveradi.
  const invalid = Boolean(base && value?.mode === "custom" && days === null);
  const dirty = Boolean(base && days !== null && days !== base.window_days);

  const setPreset = useCallback((next: PaymentCorrectionPreset) => setEdit({ mode: "preset", days: next }), []);
  // «Boshqa» — maydon joriy son bilan to'ladi: bo'sh ochilib darhol xato ko'rsatmaydi, «Saqlash» esa o'chiq qoladi.
  const setCustom = useCallback(
    () => setEdit({ mode: "custom", text: String(days ?? base?.window_days ?? PAYMENT_CORRECTION_WINDOW.fallback) }),
    [base, days],
  );
  const setText = useCallback((text: string) => setEdit({ mode: "custom", text }), []);

  const save = useCallback(async () => {
    if (days === null) return;
    await mutateAsync(days);
    setEdit(null);
  }, [days, mutateAsync]);

  return { query, value, days, invalid, dirty, setPreset, setCustom, setText, save, isSaving: update.isPending };
};

export type PaymentCorrectionDraft = ReturnType<typeof usePaymentCorrectionDraft>;
