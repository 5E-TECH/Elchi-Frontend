import {
  isPaymentReversalRow,
  toPaymentCorrection,
  type PaymentCorrectionBadgeKind,
} from "../../../../entities/payments/paymentCorrection";
import { getPaymentSourceTitle, type PaymentViewer } from "../paymentSourceType";

/**
 * T6 «To'lov tuzatish» — kassa tarixi ro'yxatlaridagi matnlar (maketlar `superadmin-payments-overview-corrected`,
 * `superadmin-payments-cash-detail-courier-corrected`, `market-cashbox-my-corrected`,
 * `courier-cashbox-my-transfers-corrected`).
 *
 * - teskari yozuv qatori ostida sabab (`comment`) EMAS — asl yozuvga havola: «#4512 · Kuryer to'lovi qaytarildi»
 *   (umumiy ro'yxat, asosiy kassa, market), «#4512 qaytarildi» (kassa tafsiloti, kuryer), tahrirda «#4498 · summa
 *   tahrirlandi». `#id` — shu kassadagi asl oyoq (`reverses_history_id` = `correction.related.id`), sarlavha —
 *   `related.source_type` ko'ruvchi nuqtai nazaridan (C10), bo'lmasa `payment_kind`;
 * - «Tuzatilgan» qatorining odatiy pastki qatoriga « · #4498 o'rniga» qo'shiladi;
 * - tugma/karta nomi (aria-label): «{sarlavha}, {belgi}».
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

type CorrectionRow = {
  correction?: unknown;
  source_type?: string | null;
  reverses_history_id?: string | number | null;
};

/** Belgi matni kalitlari (`payments:paymentCorrection.badge.*`). */
export const CORRECTION_BADGE_KEYS: Record<PaymentCorrectionBadgeKind, string> = {
  reversed: "paymentCorrection.badge.reversed",
  edited: "paymentCorrection.badge.edited",
  reversal: "paymentCorrection.badge.reversal",
  replacement: "paymentCorrection.badge.replacement",
};

export const correctionBadgeLabel = (kind: PaymentCorrectionBadgeKind, t: Translate) => t(CORRECTION_BADGE_KEYS[kind]);

const idText = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/** «Ko'rinish»: `overview` — sarlavha bilan («#id · {tur} qaytarildi»), `short` — «#id qaytarildi». */
export type ReversalRefVariant = "overview" | "short";

/**
 * Teskari yozuv qatorining pastki qatori; boshqa qator (yoki asl ID noma'lum) — `null`. `correction` kelmasa
 * (backend qidiruvi yiqildi — fail-open), lekin qator teskari yozuv bo'lsa (belgi kabi manba turidan) — asl ID
 * `reverses_history_id` dan, amal noma'lum: qisqa «#4512 qaytarildi» (ikkala ko'rinishda; sabab chiqmaydi).
 */
export const reversalRefText = (
  row: CorrectionRow,
  t: Translate,
  viewer: PaymentViewer,
  variant: ReversalRefVariant,
): string | null => {
  const correction = toPaymentCorrection(row.correction);
  if (!correction) {
    const id = isPaymentReversalRow(row) ? idText(row.reverses_history_id) : null;
    return id ? t("paymentCorrection.list.reversed", { id }) : null;
  }
  if (correction.role !== "reversal") return null;
  const id = idText(row.reverses_history_id) ?? correction.related?.id ?? correction.related_history_id;
  if (!id) return null;
  if (correction.action === "edit") return t("paymentCorrection.list.edited", { id });
  if (variant === "short") return t("paymentCorrection.list.reversed", { id });
  const title = getPaymentSourceTitle(correction.related?.source_type || correction.payment_kind, t, viewer);
  return t("paymentCorrection.list.reversedOf", { id, title });
};

/** «Tuzatilgan» qatori: «#4498 o'rniga» (asl oyoq shu kassada); boshqa qator — `null`. */
export const replacementRefText = (row: CorrectionRow, t: Translate): string | null => {
  const correction = toPaymentCorrection(row.correction);
  if (!correction || correction.role !== "replacement") return null;
  const id = correction.related?.id ?? correction.related_history_id;
  return id ? t("paymentCorrection.list.insteadOf", { id }) : null;
};

/** Tugma / karta nomidagi sarlavha: belgi bo'lsa «Kuryer to'lovi, Qaytarildi», aks holda o'zi. */
export const correctionLabelTitle = (title: string, kind: PaymentCorrectionBadgeKind | null, t: Translate) =>
  kind ? t("paymentCorrection.list.labelTitle", { title, badge: correctionBadgeLabel(kind, t) }) : title;
