/**
 * D5NxxpJW (ega 2026-11-20 / 2026-11-25): filial xodimlari (menejer, filial hisobi, registrator) buyurtmaning market
 * tarifini va undan hisoblanadigan «To'lanishi kerak» / «To'langan» ni ko'rmaydi — backend ham yubormaydi
 * (`order-role-projection` → `BRANCH_STAFF_HIDDEN_ORDER_FIELDS`). Maydon kelmasa «0 so'm» yolg'on bo'lardi, shuning
 * uchun qator umuman chizilmaydi.
 */
const BRANCH_STAFF_ROLES: readonly string[] = ["manager", "branch", "registrator"];

export const hidesMarketMoney = (role: string | null | undefined): boolean =>
  BRANCH_STAFF_ROLES.includes((role ?? "").toLowerCase());
