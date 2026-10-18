/** Balans → Tarix qatori (4WeT0Tv5): jadval va tafsilot oynasi uchun umumiy. */

import { isLedgerSourceType } from "./historyFilters";

export interface HistoryRow {
  id: string;
  date: unknown;
  sourceType: string;
  changeAmount: number;
  previousBalance: number;
  nextBalance: number;
  /** Qo'lda yozuv/tuzatishning sababi (4WeT0Tv5). */
  comment: string;
  /** `created_by` yo'q — tizim yozgan (sotuv foydasi va h.k.). */
  automatic: boolean;
  /** Kim kiritgan: ism, bo'lmasa `#id`. */
  actorName: string;
  orderId: string;
}

export const toHistoryText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/** Backend `created_by_user: {id, name}` (gateway) — bo'lmasa `#id`. */
export const toActorName = (item: Record<string, unknown>) => {
  const user = item.created_by_user as { name?: unknown } | null | undefined;
  const name = toHistoryText(user?.name);
  if (name) return name;
  const id = toHistoryText(item.created_by);
  return id ? `#${id}` : "";
};

/** Buyurtma tafsiloti sahifasi (`orders/edit/:orderId`). */
export const orderLink = (orderId: string) => `/orders/edit/${orderId}`;

/**
 * Manba nomi (maket matnlari, `payments.v2Balance.sources.*`). Eski `sell` — «Pochta foydasi»;
 * noma'lum qiymat o'zicha ko'rsatiladi (yangi backend turi yashirinmasin).
 */
export const toSourceTypeLabel = (value: string, t: (key: string) => string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "sell") return t("v2Balance.sources.sell_profit");
  if (isLedgerSourceType(normalized)) return t(`v2Balance.sources.${normalized}`);
  return value || "—";
};

/**
 * Ishorali o'zgarish: avval `balance_after − balance_before`, bo'lmasa turi bo'yicha (chiqim, maosh,
 * tuzatish — manfiy). Mantiq v1 jadvalidagi bilan AYNAN bir xil.
 */
export const getSignedChange = (item: Record<string, unknown>) => {
  const amount = Math.abs(Number(item.amount ?? 0));
  const before = Number(item.balance_before ?? item.balanceBefore);
  const after = Number(item.balance_after ?? item.balanceAfter);

  if (Number.isFinite(before) && Number.isFinite(after) && before !== after) {
    return after - before;
  }

  const operationType = String(item.operation_type ?? item.operationType ?? "").toLowerCase();
  const sourceType = String(item.source_type ?? item.sourceType ?? "").toLowerCase();

  if (operationType === "expense" || ["manual_expense", "salary", "correction"].includes(sourceType)) {
    return -amount;
  }

  return amount;
};

/** API daftar yozuvi → jadval qatori. */
export const toHistoryRow = (item: Record<string, unknown>): HistoryRow => {
  const signedChange = getSignedChange(item);
  const previousBalance = Number(item.balance_before ?? item.balanceBefore ?? 0);
  const nextBalance = Number(item.balance_after ?? item.balanceAfter ?? previousBalance + signedChange);

  return {
    id: String(item.id ?? ""),
    date: item.payment_date ?? item.paymentDate ?? item.createdAt ?? item.created_at ?? "",
    sourceType: String(item.source_type ?? ""),
    changeAmount: signedChange,
    previousBalance,
    nextBalance,
    comment: toHistoryText(item.comment),
    automatic: !toHistoryText(item.created_by),
    actorName: toActorName(item),
    orderId: toHistoryText(item.order_id),
  };
};
