/** Balans → Tarix qatori (4WeT0Tv5): jadval va tafsilot oynasi uchun umumiy. */

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

export const toSourceTypeLabel = (value: string, t: (key: string) => string) => {
  if (value === "sell" || value === "sell_profit") return t("financialBalanceSourceProfit");
  if (value === "sell_extra_cost") return t("financialBalanceSourceExtraCost");
  if (value === "cancel_extra_cost") return t("financialBalanceSourceExtraCost");
  if (value === "manual_income") return t("financialBalanceSourceManualIncome");
  if (value === "manual_expense") return t("financialBalanceSourceManualExpense");
  if (value === "salary") return t("financialBalanceSourceSalary");
  if (value === "correction") return t("financialBalanceSourceCorrection");
  if (value === "bills") return t("financialBalanceSourceBills");
  return value || "-";
};
