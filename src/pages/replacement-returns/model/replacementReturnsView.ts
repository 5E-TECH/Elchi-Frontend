import { Clock, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import {
  REPLACEMENT_RETURN_STATES,
  type ReplacementReturnItem,
  type ReplacementReturnState,
  type ReplacementReturnsParams,
} from "../../../entities/order";
import type { Tone } from "../../../shared/ui/primitives";

/**
 * «ALMASHTIRISH QAYTARMALARI» sahifasining sof qismi (lQjt6sKP): URL filtrlari, so'rov parametrlari, holat belgisi.
 *
 * Filtrlar URL'da (`?state&market`), o'zgarsa sahifa 1 ga qaytadi (`page` o'chadi), `limit` qoladi — `/returns`
 * (`returnBatches.ts`) bilan bir xil naqsh. `market` faqat superadmin va adminda yuboriladi: marketni backend tokendan
 * oladi (`market_id` e'tiborsiz), shuning uchun market rolida URL'dagi qiymat ham yuborilmaydi.
 */

export const REPLACEMENT_PAGE_SIZES = [10, 20, 50, 100] as const;
export const REPLACEMENT_DEFAULT_LIMIT = 20;

/** URL parametrlari nomlari. */
const STATE_PARAM = "state";
const MARKET_PARAM = "market";

export type ReplacementFilters = { state: ReplacementReturnState | ""; market: string };

const isState = (value: string | null): value is ReplacementReturnState =>
  (REPLACEMENT_RETURN_STATES as readonly string[]).includes(value ?? "");

/** URL → filtrlar: noma'lum holat va raqam bo'lmagan market e'tiborsiz (backend ularni 400 bilan rad etadi). */
export const readReplacementFilters = (params: URLSearchParams): ReplacementFilters => {
  const state = params.get(STATE_PARAM);
  const market = params.get(MARKET_PARAM)?.trim() ?? "";
  return { state: isState(state) ? state : "", market: /^\d{1,18}$/.test(market) ? market : "" };
};

/** Filtr o'zgardi → URL: berilgan kalitlar yoziladi yoki o'chadi, sahifa 1 ga qaytadi. */
export const writeReplacementFilters = (
  prev: URLSearchParams,
  patch: Partial<ReplacementFilters>,
): URLSearchParams => {
  const next = new URLSearchParams(prev);
  if ("state" in patch) {
    if (patch.state) next.set(STATE_PARAM, patch.state);
    else next.delete(STATE_PARAM);
  }
  if ("market" in patch) {
    if (patch.market) next.set(MARKET_PARAM, patch.market);
    else next.delete(MARKET_PARAM);
  }
  next.delete("page");
  return next;
};

/** So'rov: `state` va (faqat filtrli rolda) `market_id` — bo'shlari yuborilmaydi. */
export const buildReplacementReturnsParams = ({
  page,
  limit,
  filters,
  canFilterMarket,
}: {
  page: number;
  limit: number;
  filters: ReplacementFilters;
  canFilterMarket: boolean;
}): ReplacementReturnsParams => ({
  page,
  limit,
  ...(filters.state ? { state: filters.state } : {}),
  ...(canFilterMarket && filters.market ? { market_id: filters.market } : {}),
});

/**
 * Almashtirish holati → belgi (BeePost `stateChip`): kutilmoqda — `warning` (kuryer eskisini olishi kerak, `Clock`),
 * olingan — `info` (marketga ketmoqda, `Truck`), qaytarildi — `neutral` (zanjir yopildi, `PackageCheck` — «Marketga
 * topshirildi» bilan bir xil, `docs/DESIGN_SYSTEM.md` §8). Holat yo'q (eski yozuv) — kutilmoqda deb ko'rsatiladi.
 */
export const REPLACEMENT_STATE_META: Record<ReplacementReturnState, { tone: Tone; icon: LucideIcon }> = {
  awaiting_old_pickup: { tone: "warning", icon: Clock },
  old_collected: { tone: "info", icon: Truck },
  old_returned: { tone: "neutral", icon: PackageCheck },
};

export const stateOrDefault = (state: ReplacementReturnState | null): ReplacementReturnState =>
  state ?? "awaiting_old_pickup";

/** Buyurtma tafsiloti havolasi. */
export const replacementOrderHref = (id: string) => `/orders/edit/${encodeURIComponent(id)}`;

/** Mahsulotlar: «Telefon × 1, G'ilof × 2»; nomsiz qator chiqmaydi. */
export const replacementItemsText = (
  items: readonly ReplacementReturnItem[],
  line: (name: string, quantity: number) => string,
): string =>
  items
    .filter((item) => item.product_name)
    .map((item) => line(item.product_name as string, item.quantity))
    .join(", ");
