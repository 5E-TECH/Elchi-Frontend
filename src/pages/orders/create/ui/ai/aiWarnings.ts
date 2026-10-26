import {
  AI_WARNING_FIELDS,
  AI_WARNING_REASONS,
  type AiPreviewOrder,
  type AiWarningField,
  type AiWarningReason,
} from "../../../../../entities/ai-order";
import type { AiDraftOrder } from "./evalPreview";

/**
 * AI PREVIEW OGOHLANTIRISHLARI (J3hEDtFN): `warnings[{field, reason}]` → maydon bo'yicha sabab.
 *
 * Faqat ma'lum enum juftliklari o'qiladi (noma'lum maydon yoki sabab — tashlanadi, xom matn hech qachon
 * ko'rsatilmaydi). Bitta maydonga bir nechta sabab kelsa — birinchisi. Ogohlantirish kartaning tayyorligiga
 * (`evalPreview`, IR2OHIiN qo'riqchisi) TA'SIR QILMAYDI — faqat operatorga «tekshiring» belgisi.
 */
export type AiWarningMap = Partial<Record<AiWarningField, AiWarningReason>>;

const FIELDS = new Set<string>(AI_WARNING_FIELDS);
const REASONS = new Set<string>(AI_WARNING_REASONS);

export const readAiWarnings = (warnings: unknown): AiWarningMap => {
  const map: AiWarningMap = {};
  if (!Array.isArray(warnings)) return map;
  for (const entry of warnings) {
    const field = (entry as { field?: unknown } | null)?.field;
    const reason = (entry as { reason?: unknown } | null)?.reason;
    if (typeof field !== "string" || typeof reason !== "string") continue;
    if (!FIELDS.has(field) || !REASONS.has(reason)) continue;
    map[field as AiWarningField] ??= reason as AiWarningReason;
  }
  return map;
};

const scalar = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

const itemsSignature = (items: AiDraftOrder["items"]) =>
  JSON.stringify(items.map((item) => [scalar(item.product_id), item.quantity, Boolean(item.allow_free_text)]));

/** Maydonning tahrirlanadigan qiymati — operator uni AI qiymatidan o'zgartirdimi, shu bilan solishtiriladi. */
const fieldValue = (order: AiDraftOrder, field: AiWarningField): string => {
  switch (field) {
    case "region_name":
      return scalar(order.region_id);
    case "district_name":
      return scalar(order.district_id);
    case "items":
      return itemsSignature(order.items);
    case "is_replacement":
      // Kartada maydon yo'q — operator uni tahrirlay olmaydi, ogohlantirish qoladi.
      return "";
    default:
      return scalar((order as Record<string, unknown>)[field]);
  }
};

/**
 * Ko'rsatiladigan ogohlantirishlar: operator maydonni AI qiymatidan o'zgartirgan bo'lsa (tekshirib tuzatgan) —
 * shu maydonning belgisi yo'qoladi. `initial` — AI chiqishining tahrirgacha ko'rinishi (`toDraft(source).order`).
 */
export const activeAiWarnings = (
  warnings: AiWarningMap,
  order: AiDraftOrder,
  initial: AiDraftOrder,
): AiWarningMap => {
  const active: AiWarningMap = {};
  for (const field of Object.keys(warnings) as AiWarningField[]) {
    if (fieldValue(order, field) === fieldValue(initial, field)) active[field] = warnings[field];
  }
  return active;
};

/** Manba buyurtmadagi ogohlantirishlar (tip qisqartmasi). */
export const sourceAiWarnings = (source: AiPreviewOrder): AiWarningMap => readAiWarnings(source.warnings);
