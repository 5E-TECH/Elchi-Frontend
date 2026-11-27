import type { Tone } from "../../../shared/ui/primitives/tone";
import type { CourierHoldFilter, OrderListParams } from "../../../entities/order/types/order";
import type { CourierHoldLevel } from "../../../entities/orders/courierHold";

/**
 * «Kuryerdagi buyurtmalar» sahifasining sof mantig'i (UI'siz): URL'dagi tab va kuryer, `GET /orders` parametrlari.
 *
 * Tablar (Dilshod 2026-11-27: «3 ta ro'yxat»):
 *   over_72   — 72 soatdan oshgan buyurtmalar (`courier_hold=over_72`), sukut;
 *   near_48   — 48 soatga yaqinlashgan (36–48 soat, `courier_hold=near_48`) — ogohlantirish ketgan oyna;
 *   couriers  — kuryerda qolgan jo'natmalar kuryer bo'yicha (`GET orders/courier-hold/summary`); kuryer tanlansa
 *               (`?courier=<id>`) — o'sha kuryerdagi hamma ochiq buyurtmalar (`courier_hold=any&courier_id=<id>`).
 * Kuryer tanlovi qolgan ikki tabda ham ishlaydi (ro'yxat shu kuryerga toraytiriladi).
 */

export const COURIER_HOLD_TABS = ["over_72", "near_48", "couriers"] as const;
export type CourierHoldTab = (typeof COURIER_HOLD_TABS)[number];

const TAB_PARAM = "tab";
export const COURIER_PARAM = "courier";

export const COURIER_HOLD_PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const COURIER_HOLD_DEFAULT_LIMIT = 25;

export const isCourierHoldTab = (value: unknown): value is CourierHoldTab =>
  typeof value === "string" && (COURIER_HOLD_TABS as readonly string[]).includes(value);

/** URL → tab; noma'lum yoki yo'q — «72 soatdan oshgan». */
export const readCourierHoldTab = (params: URLSearchParams): CourierHoldTab => {
  const value = params.get(TAB_PARAM)?.trim().toLowerCase();
  return isCourierHoldTab(value) ? value : "over_72";
};

/** URL → tanlangan kuryer id (faqat raqam; boshqasi — yo'q). */
export const readCourierHoldCourier = (params: URLSearchParams): string => {
  const value = params.get(COURIER_PARAM)?.trim() ?? "";
  return /^\d{1,19}$/.test(value) ? value : "";
};

/**
 * Tab almashdi → URL: sukut tab — parametrsiz; sahifa 1 ga qaytadi. «Kuryerlar bo'yicha» ga o'tilsa kuryer tanlovi
 * tozalanadi (jamlama ko'rinsin); qolgan tablarga o'tilsa — saqlanadi.
 */
export const writeCourierHoldTab = (prev: URLSearchParams, tab: CourierHoldTab): URLSearchParams => {
  const next = new URLSearchParams(prev);
  if (tab === "over_72") next.delete(TAB_PARAM);
  else next.set(TAB_PARAM, tab);
  if (tab === "couriers") next.delete(COURIER_PARAM);
  next.delete("page");
  return next;
};

/** Kuryer tanlandi / olib tashlandi → URL (sahifa 1 ga). */
export const writeCourierHoldCourier = (prev: URLSearchParams, courierId: string): URLSearchParams => {
  const next = new URLSearchParams(prev);
  if (courierId) next.set(COURIER_PARAM, courierId);
  else next.delete(COURIER_PARAM);
  next.delete("page");
  return next;
};

/** Ro'yxat ko'rinadimi (kuryerlar tabida — faqat kuryer tanlanganda). */
export const showsOrderList = (tab: CourierHoldTab, courierId: string): boolean => tab !== "couriers" || Boolean(courierId);

/** Tab → `courier_hold` qiymati (kuryerlar tabidagi tanlangan kuryer — hamma ochiq buyurtmalari). */
export const courierHoldFilterOf = (tab: CourierHoldTab): CourierHoldFilter => (tab === "couriers" ? "any" : tab);

/** `GET /orders` parametrlari (doira backend'da, tokendan; saralash yo'q — eng eskisi birinchi). */
export const buildCourierHoldListParams = (
  tab: CourierHoldTab,
  courierId: string,
  paging: { page: number; limit: number },
): OrderListParams => ({
  page: paging.page,
  limit: paging.limit,
  courier_hold: courierHoldFilterOf(tab),
  ...(courierId ? { courier_id: courierId } : {}),
});

/** /orders dagi filtrga havola (kuryerdan boshqa rollar — ularda /orders da «Kuryerda turgan vaqti» bor). */
export const ordersListHref = (tab: CourierHoldTab, courierId: string): string => {
  const params = new URLSearchParams({ courier_hold: courierHoldFilterOf(tab) });
  if (courierId) params.set("orderCourierId", courierId);
  return `/orders?${params.toString()}`;
};

/** Daraja → belgi toni: 36 dan kam — neytral, 36–48 — ogohlantirish, 48+ — xavf. */
export const COURIER_HOLD_LEVEL_TONE: Record<CourierHoldLevel, Tone> = {
  ok: "neutral",
  near: "warning",
  over_48: "danger",
  over_72: "danger",
};

/** Buyurtma tafsiloti (barcha rollar uchun bitta yo'l — `routes.tsx` → `/orders/edit/:orderId`). */
export const courierHoldOrderHref = (orderId: string) => `/orders/edit/${encodeURIComponent(orderId)}`;
