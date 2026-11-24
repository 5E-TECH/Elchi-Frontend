/**
 * `items` MATN bo'lib kelganda mahsulot qatorlari (Lidershop, Alion: "Diskali soat x 1 = 99 000 so'm").
 *
 * ⚠️ BACKEND NUSXASI — `apps/order-service/src/lifecycle/external-items-text.ts` (`readExternalItemsText`). Ro'yxatda
 * ko'ringan mahsulot yaratiladigan buyurtmaniki bilan bir xil bo'lsin: qoida o'zgarsa ikkalasi (va ularning test
 * jadvallari) birga o'zgaradi.
 */

import { fitProductName, fitQuantity } from "./siteItemLimits";

/**
 * Bitta qator: `<nom> x <son> = <summa>`, so'ng vergul / `;` / yangi qator yoki matn oxiri.
 *  - `= <summa>` majburiy: usiz "Gilam 2 x 3" (o'lcham) ham son deb o'qilardi;
 *  - son 1–999: "Soat x 99000 = 99000" da narx son bo'lib ketmasin;
 *  - nom ichida vergul bo'lishi mumkin, `=` — yo'q (ajralmagan oldingi qator keyingisiga yutilmasin); yangi qator va
 *    `;` doim chegara;
 *  - raqam yopishgan vergul ("99,000") chegara emas;
 *  - ko'paytirish belgisi — `x` (lotin yoki kirill), `×` yoki `*`.
 * Summa faqat qator oxirini bilish uchun — qiymati o'qilmaydi (`total_price` / `delivery_price`).
 */
const ROW =
  // design-guard-ignore: sayt yuborgan matnni O'QISH regexi — ekranga chiqmaydi, formatlash emas
  /([^\n;=]+?) [xх×*] ?([1-9]\d{0,2}) ?= ?\d+(?:[ .,]\d{3})*(?:[.,]\d{1,2})?(?: ?(?:so['’‘ʻʼ`´]?m|sum|сум|сўм|сом|uzs|usd|\$)\.?)? ?(?:(?:,(?!\d)|[;\n])[,;\s]*|$)/iuy;

/** Har xil bo'shliq (NBSP ham) bitta bo'shliqqa; yangi qator saqlanadi. */
const normalizeText = (raw: string): string =>
  raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();

/** Har xil bo'shliq bittaga keltirilgan va ustun sig'imiga kesilgan nom. */
const productName = (raw: string): string => fitProductName(raw.replace(/\s+/g, " ").trim());

/** `total_count` — musbat butun son (yoki shunday matn), aks holda 1. */
const fallbackQuantity = (totalCount: unknown): number => {
  if (typeof totalCount !== "number" && typeof totalCount !== "string") return 1;
  return fitQuantity(Number(totalCount));
};

type SiteTextItem = { name: string; quantity: number };

/** Matn TO'LIQ qatorlarga ajralsa — ular, bir bo'lagi ham qolsa — `null`. */
const parseRows = (text: string): SiteTextItem[] | null => {
  const rows: SiteTextItem[] = [];
  ROW.lastIndex = 0;
  while (ROW.lastIndex < text.length) {
    const match = ROW.exec(text);
    if (!match) return null;
    rows.push({ name: productName(match[1]), quantity: Number(match[2]) });
  }
  return rows;
};

/**
 * Matndan mahsulot qatorlari. Ishonch bilan ajralmasa — butun matn bitta qator nomi, soni `total_count` yoki 1. Harf
 * ham raqam ham yo'q matn ("", "-", "[]") — mahsulot emas.
 */
export const readItemsText = (raw: string, totalCount: unknown): SiteTextItem[] => {
  const text = normalizeText(raw);
  if (!/[\p{L}\p{N}]/u.test(text)) return [];
  return parseRows(text) ?? [{ name: productName(text), quantity: fallbackQuantity(totalCount) }];
};
