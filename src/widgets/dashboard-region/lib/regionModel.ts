import type { RegionItem } from "../../../entities/region";
import { findRegionTile, type RegionTile } from "./regionTileLayout";

/** Kartogramma ko'rsatkichi: buyurtmalar soni, muvaffaqiyat foizi, daromad. */
export type RegionMetric = "orders" | "success" | "revenue";

export interface RegionRow {
  id: string;
  /** Ko'rinadigan nom (katak topilsa — maket nomi, aks holda API nomi). */
  name: string;
  tile?: RegionTile;
  orders: number;
  delivered: number;
  cancelled: number;
  pending: number;
  revenue: number;
  /** 0..100 */
  rate: number;
  activeCouriers: number;
  /** Asl qator (dialog uchun). */
  item: RegionItem;
}

const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Backend qatori → ko'rinish qatori; buyurtmalar soni bo'yicha kamayish tartibida. */
export const toRegionRows = (regions: readonly RegionItem[]): RegionRow[] =>
  regions
    .map((item) => {
      const tile = findRegionTile(item.name);
      const orders = finite(item.ordersCount);
      const delivered = finite(item.deliveredOrders);
      const rate = finite(item.successRate) || (orders > 0 ? (delivered / orders) * 100 : 0);
      return {
        id: item.id,
        name: tile?.label ?? item.name,
        tile,
        orders,
        delivered,
        cancelled: finite(item.cancelledOrders),
        pending: finite(item.pendingOrders),
        revenue: finite(item.totalRevenue),
        rate: Math.min(100, Math.max(0, rate)),
        activeCouriers: finite(item.activeCouriers),
        item,
      };
    })
    .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));

/** Ketma-ket shkala pog'onasi: 0 — buyurtma yo'q, 1..4 — `region-map-low … xhigh`. */
export type RegionStep = 0 | 1 | 2 | 3 | 4;

/** Buyurtmalar: 1–9 · 10–29 · 30–79 · 80+ (maket legendasi «1–9 … 80+»). */
export const ORDER_STEPS = [10, 30, 80] as const;
/** Muvaffaqiyat: < 40 · 40–59 · 60–74 · 75+. */
export const SUCCESS_STEPS = [40, 60, 75] as const;

export const regionStep = (row: RegionRow, metric: RegionMetric, maxRevenue: number): RegionStep => {
  if (row.orders <= 0) return 0;
  if (metric === "orders") {
    if (row.orders >= ORDER_STEPS[2]) return 4;
    if (row.orders >= ORDER_STEPS[1]) return 3;
    if (row.orders >= ORDER_STEPS[0]) return 2;
    return 1;
  }
  if (metric === "success") {
    if (row.rate >= SUCCESS_STEPS[2]) return 4;
    if (row.rate >= SUCCESS_STEPS[1]) return 3;
    if (row.rate >= SUCCESS_STEPS[0]) return 2;
    return 1;
  }
  if (maxRevenue <= 0 || row.revenue <= 0) return 1;
  const ratio = row.revenue / maxRevenue;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
};

/**
 * Pog'ona → katak klassi (`--color-region-map-*`, `--seq-*` YO'Q). Matn rangi kontrast bo'yicha:
 * och pog'onalarda `region-map-label` (kunduzi to'q, tunda oq), eng to'q pog'onada `surface`
 * (kunduzi oq, tunda to'q fon ustida to'q matn — tungi `xhigh` och ko'k).
 */
export const STEP_CLASS: Record<RegionStep, string> = {
  0: "bg-sunken text-text-subtle",
  1: "bg-region-map-low text-region-map-label",
  2: "bg-region-map-medium text-region-map-label",
  3: "bg-region-map-high text-region-map-label",
  4: "bg-region-map-xhigh text-surface",
};

export interface RegionSummaryModel {
  totalOrders: number;
  totalDelivered: number;
  totalCancelled: number;
  totalPending: number;
  totalRevenue: number;
  activeCouriers: number;
  regionsWithCouriers: number;
  top?: RegionRow;
  /** Eng past sotuv — kamida 10 ta buyurtmali hududlar orasida. */
  lowest?: RegionRow;
  /** Eng yuqori bekor ulushi — kamida 10 ta buyurtmali hududlar orasida. */
  mostCancelled?: RegionRow;
}

export const MIN_ORDERS_FOR_RANK = 10;

export const summarizeRegions = (rows: readonly RegionRow[]): RegionSummaryModel => {
  const eligible = rows.filter((row) => row.orders >= MIN_ORDERS_FOR_RANK);
  const lowest = eligible.reduce<RegionRow | undefined>((min, row) => (!min || row.rate < min.rate ? row : min), undefined);
  const mostCancelled = eligible.reduce<RegionRow | undefined>(
    (max, row) => (!max || row.cancelled / row.orders > max.cancelled / max.orders ? row : max),
    undefined,
  );
  return {
    totalOrders: rows.reduce((sum, row) => sum + row.orders, 0),
    totalDelivered: rows.reduce((sum, row) => sum + row.delivered, 0),
    totalCancelled: rows.reduce((sum, row) => sum + row.cancelled, 0),
    totalPending: rows.reduce((sum, row) => sum + row.pending, 0),
    totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    activeCouriers: rows.reduce((sum, row) => sum + row.activeCouriers, 0),
    regionsWithCouriers: rows.filter((row) => row.activeCouriers > 0).length,
    top: rows[0] && rows[0].orders > 0 ? rows[0] : undefined,
    lowest,
    mostCancelled: mostCancelled && mostCancelled.cancelled > 0 ? mostCancelled : undefined,
  };
};
