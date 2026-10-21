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
  /** Kamida shuncha buyurtma (≥ 1). */
  min_orders?: number;
}

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

/**
 * Filtrlar → so'rov tanasi. Bo'sh qiymatlar tashlanadi; `min_orders` — butun son ≥ 1 (aks holda tashlanadi).
 * Backend `last_order_to` ni QAT'IY chegara deb oladi (`< to`) — tanlangan oxirgi kun ham kirsin deb keyingi
 * kun yuboriladi («01.07 – 30.09» → `last_order_to: "2026-10-01"`).
 */
export const toCustomerSegmentPayload = (segment: CustomerSegment): CustomerSegmentPayload => {
  const payload: CustomerSegmentPayload = {};
  for (const key of ["region_id", "district_id", "market_id", "last_order_from"] as const) {
    const value = filled(segment[key]);
    if (value) payload[key] = value;
  }
  const to = filled(segment.last_order_to);
  if (to) payload.last_order_to = nextIsoDay(to);
  const min = Number(segment.min_orders);
  if (Number.isInteger(min) && min >= 1) payload.min_orders = min;
  return payload;
};

/** Hech qaysi filtr tanlanmagan (butun mijozlar bazasi). */
export const isCustomerSegmentEmpty = (segment: CustomerSegment) =>
  Object.keys(toCustomerSegmentPayload(segment)).length === 0;

/**
 * «Buyurtmalar soni — dan» maydoni matni → son. Bo'sh, 0, manfiy yoki son bo'lmagan — `undefined`; kasr pastga.
 */
export const parseMinOrders = (value: string): number | undefined => {
  const number = Math.floor(Number(value.replace(/\s/g, "")));
  return Number.isFinite(number) && number >= 1 ? number : undefined;
};
