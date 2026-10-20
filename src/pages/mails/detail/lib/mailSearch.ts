import type { PostOrder } from "../../../../entities/mails";
import { formatPhone, parseUzbekPhone } from "../../../../shared/lib/formatPhone";

/**
 * POCHTA ICHIDA QIDIRUV VA TAKRORIY TELEFONLAR (MD-1; maketlar `*-mails-detail-search*`,
 * `*-mails-detail-duplicates`, menejerda `manager-mails-detail-receive-*`). Hammasi klient tomonda — sahifa
 * pochtaning barcha buyurtmalarini yuklaydi (backend maydoni kerak emas, ega S1–S4).
 *
 *  - qidiruv: № (`№10207`, `#10207`, `10207`), mijoz ismi (registr va apostrof turlari farqsiz: `o'`, `o‘`,
 *    `oʻ`), telefon (`+998 90 …`, `998…`, `90 233 51 79`, raqam qismi — `parseUzbekPhone`), tuman, market (S3);
 *  - takroriy telefon: faqat shu pochta ichida (S2), raqam `parseUzbekPhone` bilan normallashadi
 *    (`+998` siz yozilgani ham bir xil).
 */

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
};

/** Mijoz ismi — API'ning turli shakllaridan (bo'sh bo'lsa `""`). */
export const readCustomerName = (order: PostOrder) => {
  const record = asRecord(order);
  const customer = asRecord(order.customer);
  return firstText(
    customer.name,
    customer.full_name,
    customer.fullName,
    record.customer_name,
    record.customerName,
    record.client_name,
    record.clientName,
    record.receiver_name,
    record.receiverName,
    record.name,
  );
};

/** Mijoz telefoni — xom ko'rinishda (bo'sh bo'lsa `""`). */
export const readCustomerPhone = (order: PostOrder) => {
  const record = asRecord(order);
  const customer = asRecord(order.customer);
  return firstText(
    customer.phone_number,
    customer.phoneNumber,
    customer.phone,
    record.customer_phone,
    record.customerPhone,
    record.phone_number,
    record.phoneNumber,
    record.phone,
  );
};

/** Apostrof turlari (o'zbek lotinidagi `ʻ`, `’`, `‘`, backtick …) — solishtirishda olib tashlanadi. */
const APOSTROPHES = /['‘’ʻʼ`´ʹ′]/g;

/** Solishtirish uchun matn: kichik harf, apostrofsiz, bo'shliqlar bitta. */
export const normalizeSearchText = (value: unknown) =>
  (typeof value === "string" ? value : typeof value === "number" ? String(value) : "")
    .toLocaleLowerCase("uz")
    .replace(APOSTROPHES, "")
    .replace(/\s+/g, " ")
    .trim();

/** Telefonning solishtirish kaliti: O'zbekiston raqami — 9 xonali mahalliy qism, aks holda faqat raqamlar. */
export const phoneKey = (raw: unknown) => {
  const local = parseUzbekPhone(raw);
  if (local) return local;
  return typeof raw === "string" ? raw.replace(/\D/g, "") : "";
};

export type MailSearchField = "number" | "phone" | "name" | "district" | "market";

export type MailSearchQuery = {
  /** Normallashgan matn (bo'sh — qidiruv yo'q). */
  text: string;
  /** Faqat raqamlardan iborat so'rov (ajratkichlar, `+`, `№`, `#` olib tashlangan) yoki `null`. */
  digits: string | null;
  /** `№` / `#` bilan boshlangan — faqat buyurtma raqami. */
  numberOnly: boolean;
  /** To'liq O'zbekiston raqami (9 xonali mahalliy qism) — telefon aniq solishtiriladi. */
  phone: string | null;
};

const DIGIT_LIKE = /^[+№#]?\s*\(?\d[\d\s().\-‐-―]*$/;

export const parseMailSearch = (raw: string): MailSearchQuery => {
  const trimmed = raw.trim();
  const text = normalizeSearchText(trimmed);
  const numberOnly = /^[№#]/.test(trimmed);
  const digits = DIGIT_LIKE.test(trimmed) ? trimmed.replace(/\D/g, "") : null;
  return {
    text,
    digits: digits || null,
    numberOnly,
    phone: numberOnly ? null : parseUzbekPhone(trimmed),
  };
};

/** Buyurtma so'rovga mos keladimi — qaysi maydon bo'yicha (birinchi mos kelgani) yoki `null`. */
export const matchMailOrder = (order: PostOrder, query: MailSearchQuery): MailSearchField | null => {
  if (!query.text) return null;

  if (query.digits) {
    if (String(order.id).includes(query.digits)) return "number";
    if (query.numberOnly) return null;
    const key = phoneKey(readCustomerPhone(order));
    if (key) {
      if (query.phone) {
        if (key === query.phone) return "phone";
      } else if (key.includes(query.digits) || `998${key}`.includes(query.digits)) {
        return "phone";
      }
    }
    return null;
  }

  if (normalizeSearchText(readCustomerName(order)).includes(query.text)) return "name";
  if (normalizeSearchText(order.district?.name).includes(query.text)) return "district";
  if (normalizeSearchText(order.market?.name).includes(query.text)) return "market";
  return null;
};

export type MailSearchResult = {
  /** Qidiruv faolmi (bo'sh bo'lmagan so'rov). */
  active: boolean;
  /** Ko'rinadigan buyurtmalar (qidiruv yo'q — hammasi). */
  visible: PostOrder[];
  /** Hammasi faqat market nomi bo'yicha topildi — holat qatorida «· market nomi bo'yicha». */
  byMarket: boolean;
};

export const filterMailOrders = (orders: PostOrder[], raw: string): MailSearchResult => {
  const query = parseMailSearch(raw);
  if (!query.text) return { active: false, visible: orders, byMarket: false };
  const fields: MailSearchField[] = [];
  const visible = orders.filter((order) => {
    const field = matchMailOrder(order, query);
    if (field) fields.push(field);
    return field !== null;
  });
  return { active: true, visible, byMarket: fields.length > 0 && fields.every((field) => field === "market") };
};

export type DuplicatePhoneGroup = {
  /** Solishtirish kaliti (`phoneKey`). */
  key: string;
  /** Ko'rsatish uchun («+998 90 233 51 79»). */
  phone: string;
  /** Shu raqamli buyurtmalar (pochtadagi tartibda). */
  orderIds: string[];
};

/** Shu pochtada bir xil raqamga ketayotgan buyurtmalar guruhlari (≥ 2 ta; birinchi uchrashi tartibida). */
export const findDuplicatePhones = (orders: PostOrder[]): DuplicatePhoneGroup[] => {
  const groups = new Map<string, DuplicatePhoneGroup>();
  for (const order of orders) {
    const raw = readCustomerPhone(order);
    const key = phoneKey(raw);
    if (key.length < 7) continue;
    const group = groups.get(key);
    if (group) group.orderIds.push(String(order.id));
    else groups.set(key, { key, phone: formatPhone(raw), orderIds: [String(order.id)] });
  }
  return [...groups.values()].filter((group) => group.orderIds.length > 1);
};

/** Buyurtma → shu raqamga ketayotgan BOSHQA buyurtmalar (qator belgisi «Shu raqamga yana: №…»). */
export const duplicateSiblings = (groups: DuplicatePhoneGroup[]) => {
  const siblings = new Map<string, string[]>();
  for (const group of groups) {
    for (const id of group.orderIds) siblings.set(id, group.orderIds.filter((other) => other !== id));
  }
  return siblings;
};

/** Faol chip: so'rov shu guruh raqamining o'zi (`+998` bilan yoki siz). */
export const isPhoneQuery = (raw: string, group: DuplicatePhoneGroup) => {
  const local = parseUzbekPhone(raw.trim());
  return local !== null && local === group.key;
};

/**
 * USB skaner qidiruv maydoni fokusda bo'lganda tokenni maydonga ham yozadi (skaner tugma bosishlarini
 * to'xtatmaydi). Skandan keyin maydon oldingi qiymatiga qaytariladi: oxirgi tez ketma-ket o'zgarishlar
 * (oralig'i `gapMs` dan kichik — skaner tezligi) bitta «portlash»; qaytariladigan qiymat — portlashdan oldingisi.
 * Oxirgi o'zgarish `windowMs` dan eski bo'lsa (skaner maydonga yozmagan) — `null`.
 */
export type SearchEdit = { before: string; after: string; at: number };

export const valueBeforeScan = (edits: readonly SearchEdit[], now: number, gapMs = 120, windowMs = 1000) => {
  if (edits.length === 0) return null;
  let index = edits.length - 1;
  if (now - edits[index].at > windowMs) return null;
  while (index > 0 && edits[index].at - edits[index - 1].at <= gapMs) index -= 1;
  return edits[index].before;
};
