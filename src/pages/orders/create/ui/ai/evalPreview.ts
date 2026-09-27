import { toLocalPhone, type AiPreviewOrder } from "../../../../../entities/ai-order";

/**
 * AI PREVIEW KARTASINING TAYYORLIGI.
 *
 * Operator AI chiqishini ko'r-ko'rona tasdiqlay olmasligi kerak: har
 * kamchilik alohida KALIT bilan qaytadi (matn emas — tarjima UI qatlamida),
 * va bitta kamchilik bo'lsa ham karta `ready` emas, ya'ni yaratishga
 * yuborilmaydi.
 */

/**
 * Narx shu qiymatdan kichik (0 ham) bo'lsa operator uni ATAYLAB tasdiqlashi
 * shart — AI ko'pincha "150" (ming) yoki bo'sh narxni 0 deb o'qiydi.
 */
export const PRICE_CONFIRM_THRESHOLD = 10_000;

export const AI_ISSUES = [
  "name_missing",
  "phone_invalid",
  "region_missing",
  "district_missing",
  "price_missing",
  "price_confirm",
  "items_missing",
  "item_unresolved",
] as const;

export type AiIssue = (typeof AI_ISSUES)[number];

/** Operator tahrirlayotgan preview + faqat UI'da yashaydigan narx tasdig'i. */
export type AiDraftOrder = AiPreviewOrder & { price_confirmed?: boolean };

export const isItemResolved = (item: AiPreviewOrder["items"][number]) =>
  Boolean(item.product_id) || (item.allow_free_text === true && Boolean(item.name?.trim()));

export const needsPriceConfirm = (order: AiDraftOrder) =>
  order.total_price !== null &&
  Number.isFinite(Number(order.total_price)) &&
  Number(order.total_price) < PRICE_CONFIRM_THRESHOLD;

export const evalPreview = (order: AiDraftOrder): { ready: boolean; issues: AiIssue[] } => {
  const issues: AiIssue[] = [];
  const price = order.total_price;

  if (!order.customer_name?.trim()) issues.push("name_missing");
  if (!toLocalPhone(order.phone_number)) issues.push("phone_invalid");
  if (!order.region_id) issues.push("region_missing");
  if (!order.district_id) issues.push("district_missing");
  if (price === null || !Number.isFinite(Number(price))) issues.push("price_missing");
  else if (needsPriceConfirm(order) && !order.price_confirmed) issues.push("price_confirm");
  if (order.items.length === 0) issues.push("items_missing");
  else if (!order.items.every(isItemResolved)) issues.push("item_unresolved");

  return { ready: issues.length === 0, issues };
};
