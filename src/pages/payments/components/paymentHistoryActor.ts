import type { PaymentHistoryActor, PaymentRow } from "./patmentHistoryTable";
import { isOrderLinkedSource } from "./paymentSourceType";

const getActorName = (actor?: PaymentRow["created_by_user"]) => {
  if (!actor) return "";

  return (
    actor.name?.trim() ||
    actor.full_name?.trim() ||
    [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim()
  );
};

const isMeaningfulName = (value: string) => {
  const normalized = value.trim();
  return Boolean(normalized) && normalized !== "-" && normalized !== "—" && !/^\d+$/.test(normalized);
};

export const resolvePaymentActorName = (row: PaymentRow) => {
  const createdActorName = [row.created_by_user, row.createdByUser]
    .map(getActorName)
    .find(Boolean);

  if (createdActorName) return createdActorName;

  const createdBy = String(row.created_by ?? "").trim();
  if (isMeaningfulName(createdBy)) return createdBy;

  return "-";
};

/** Ism: `name` → `full_name` → «ism familiya»; bo'lmasa — bo'sh satr. */
export const getPaymentActorName = (actor?: Partial<PaymentHistoryActor> | null) =>
  getActorName(actor as PaymentHistoryActor | null | undefined);

/**
 * Qarshi tomon (jadvaldagi «Manba» ostidagi qator, maket): buyurtma bo'yicha manbada «Buyurtma №{source_id}»
 * (`orderLabel`), aks holda manba foydalanuvchisi (kuryer, market — backend faqat `courier_payment` /
 * `market_payment` da beradi), so'ng izoh; hech biri yo'q — `null`.
 */
export const resolvePaymentCounterparty = (
  row: PaymentRow,
  orderLabel: (id: string) => string,
): string | null => {
  const sourceId = String(row.source_id ?? "").trim();
  if (isOrderLinkedSource(row.source_type) && sourceId) return orderLabel(sourceId);

  const sourceName = [row.source_user, row.sourceUser].map(getActorName).find(Boolean);
  if (sourceName) return sourceName;

  const comment = row.comment?.trim();
  return comment || null;
};
