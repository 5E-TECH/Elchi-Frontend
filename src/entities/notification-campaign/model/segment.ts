/**
 * MIJOZLAR SEGMENTI (KM-1, sVByLMnt #5 / ebSV5oyP) — reklama kampaniyasining mijoz filtrlari.
 *
 * Backend: order-service `order.customer.segment` (`customer-segment.service.ts`) — buyurtmalar bo'yicha
 * `market_id`, `region_id`, `district_id`, `min_orders` (faqat > 1 ta'sir qiladi), oxirgi buyurtma sanasi
 * (`MAX(createdAt) >= last_order_from`, `MAX(createdAt) < last_order_to`). SMS kampaniyasi DTO'sida
 * `max_orders` («gacha») YO'Q — UI faqat minimumni beradi (maketdagi «gacha» — «Taklif · backend kerak»).
 */
export interface CustomerSegment {
  region_id?: string;
  district_id?: string;
  market_id?: string;
  /** `YYYY-MM-DD` — oraliq boshi (kiradi). */
  last_order_from?: string;
  /** `YYYY-MM-DD` — oraliq oxiri (UI'da kiradi; so'rovda keyingi kun — `toCustomerSegmentPayload`). */
  last_order_to?: string;
  /** Kamida shuncha buyurtma (1 … `MAX_MIN_ORDERS`). */
  min_orders?: number;
}

/** «Buyurtmalar soni — dan» yuqori chegarasi: backend DTO `@Max(1000)` (`SmsCampaignSegmentDto.min_orders`). */
export const MAX_MIN_ORDERS = 1000;

/**
 * Sana chegarasi Toshkent yarim tunida. order-service yalang `YYYY-MM-DD` ni `new Date()` bilan UTC yarim tuni deb
 * o'qiydi — Toshkentda 05:00; shuning uchun mintaqa aniq yuboriladi (DTO `@IsISO8601`).
 */
const TASHKENT_OFFSET = "+05:00";

/** So'rovga ketadigan shakl: bo'sh maydonlarsiz. */
export type CustomerSegmentPayload = Partial<Record<Exclude<keyof CustomerSegment, "min_orders">, string>> & {
  min_orders?: number;
};

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` + 1 kun (kalendar bo'yicha, vaqt mintaqasiz). Noto'g'ri qiymat — o'zgarmaydi. */
export const nextIsoDay = (day: string): string => {
  const match = ISO_DAY.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  return date.toISOString().slice(0, 10);
};

const filled = (value: string | undefined) => (value ?? "").trim();

/** `YYYY-MM-DD` → shu kunning Toshkent yarim tuni (`YYYY-MM-DDT00:00:00+05:00`); noto'g'ri qiymat — `undefined`. */
const tashkentMidnight = (day: string): string | undefined =>
  ISO_DAY.test(day) ? `${day}T00:00:00${TASHKENT_OFFSET}` : undefined;

/**
 * Filtrlar → so'rov tanasi. Bo'sh qiymatlar tashlanadi; `min_orders` — butun son ≥ 1 (aks holda tashlanadi),
 * `MAX_MIN_ORDERS` dan katta — chegaraga tushiriladi. Sanalar Toshkent vaqtida: `last_order_from` — tanlangan
 * kunning yarim tuni; backend `last_order_to` ni QAT'IY chegara deb oladi (`< to`) — tanlangan oxirgi kun ham
 * kirsin deb keyingi kunning yarim tuni yuboriladi («01.07 – 30.09» → `"2026-07-01T00:00:00+05:00"` …
 * `"2026-10-01T00:00:00+05:00"`). Noto'g'ri sana tashlanadi.
 */
export const toCustomerSegmentPayload = (segment: CustomerSegment): CustomerSegmentPayload => {
  const payload: CustomerSegmentPayload = {};
  for (const key of ["region_id", "district_id", "market_id"] as const) {
    const value = filled(segment[key]);
    if (value) payload[key] = value;
  }
  const from = tashkentMidnight(filled(segment.last_order_from));
  if (from) payload.last_order_from = from;
  const to = filled(segment.last_order_to);
  const toBound = to ? tashkentMidnight(nextIsoDay(to)) : undefined;
  if (toBound) payload.last_order_to = toBound;
  const min = Number(segment.min_orders);
  if (Number.isInteger(min) && min >= 1) payload.min_orders = Math.min(min, MAX_MIN_ORDERS);
  return payload;
};

/** Hech qaysi filtr tanlanmagan (butun mijozlar bazasi). */
export const isCustomerSegmentEmpty = (segment: CustomerSegment) =>
  Object.keys(toCustomerSegmentPayload(segment)).length === 0;

/**
 * «Buyurtmalar soni — dan» maydoni matni → son. Bo'sh, 0, manfiy yoki son bo'lmagan — `undefined`; kasr pastga;
 * `MAX_MIN_ORDERS` dan katta — chegara (backend 400 bermasin).
 */
export const parseMinOrders = (value: string): number | undefined => {
  const number = Math.floor(Number(value.replace(/\s/g, "")));
  return Number.isFinite(number) && number >= 1 ? Math.min(number, MAX_MIN_ORDERS) : undefined;
};
