/**
 * Mahsulot qatori backend ustunlariga sig'sin (matn va massiv yo'llari uchun bitta chegara).
 *
 * ⚠️ BACKEND NUSXASI — `apps/order-service/src/lifecycle/external-item-limits.ts`. Ro'yxatda ko'ringan nom va son
 * yaratiladigan buyurtmaga aynan yozilsin: qoida o'zgarsa ikkalasi birga o'zgaradi.
 */

/** Backend ustunlari: nom — varchar(255), son va buyurtma bo'yicha yig'indi — int4. */
const PRODUCT_NAME_MAX = 255;
const QUANTITY_MAX = 2_147_483_647;

/** Belgilar bo'yicha (surrogat juftlik bo'linmasin) ustun sig'imiga kesadi. */
export const fitProductName = (name: string): string => Array.from(name).slice(0, PRODUCT_NAME_MAX).join("");

/** Musbat butun va int4 ga sig'adigan son; aks holda (kasr ham) — 1. */
export const fitQuantity = (quantity: number): number =>
  Number.isInteger(quantity) && quantity > 0 && quantity <= QUANTITY_MAX ? quantity : 1;

/** Yig'indini int4 dan oshiradigan qatorning soni — 1. */
export const fitTotalQuantity = <T extends { quantity: number }>(rows: T[]): T[] => {
  let left = QUANTITY_MAX - rows.length;
  return rows.map((row) => {
    const extra = row.quantity - 1;
    if (extra > left) return { ...row, quantity: 1 };
    left -= extra;
    return row;
  });
};
