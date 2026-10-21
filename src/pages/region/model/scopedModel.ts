import { pendingOf, successRateOf, type DistrictStatsItem } from "../../../entities/region";

/**
 * Scoped `/regions` (menejer, kuryer — `GET region/my/district-stats`) tumanlar modeli.
 */

export interface DistrictRow {
  id: string;
  name: string;
  satoCode?: string;
  orders: number;
  sold: number;
  cancelled: number;
  pending: number;
  /**
   * Tushum (so'm). LG-3 (ega LG-S1): logist ko'rinishida (`withRevenue: false`) umuman yo'q — pul maydoni
   * qatorga o'tmaydi, UI ustun/blokni shunga qarab yashiradi (prop unutilsa ham pul chiqmaydi).
   */
  revenue?: number;
  /** 0..100 */
  rate: number;
  /**
   * LG-3 (additiv): tumandagi kuryerlar soni — `stats/:id` → `districts[].couriers.length`, `my/district-stats` →
   * `couriersCount` (normalizator `activeCouriers` ga yozadi).
   */
  couriers: number;
}

export const toDistrictRows = (
  districts: DistrictStatsItem[],
  { withRevenue = true }: { withRevenue?: boolean } = {},
): DistrictRow[] =>
  districts
    .map((district): DistrictRow => {
      const orders = Math.max(0, district.totalOrders);
      const sold = Math.max(0, district.deliveredOrders);
      const cancelled = Math.max(0, district.cancelledOrders);
      const row: DistrictRow = {
        id: district.id,
        name: district.name,
        satoCode: district.satoCode,
        orders,
        sold,
        cancelled,
        pending: pendingOf(orders, sold, cancelled, district.pendingOrders),
        rate: successRateOf(sold, orders),
        couriers: Math.max(0, district.activeCouriers),
      };
      if (withRevenue) row.revenue = Math.max(0, district.revenue);
      return row;
    })
    .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));

/** Tuman katagi pog'onasi: 0 — buyurtma yo'q, 1..4 — `region-map-low … xhigh`. */
export type TileStep = 0 | 1 | 2 | 3 | 4;

/**
 * Dinamik shkala (maket: menejer «1–4 … 40+», kuryer «1–2 … 9+» — eng kattasiga qarab): 4 teng qadam,
 * qadam = ⌈max / 4⌉. Ilovada 4 ta `region-map` tokeni bor (maketdagi 5 pog'ona o'rniga).
 */
export const tileScale = (maxOrders: number) => {
  const size = Math.max(1, Math.ceil(maxOrders / 4));
  const bounds = [1, size + 1, size * 2 + 1, size * 3 + 1] as const;
  const stepOf = (orders: number): TileStep => {
    if (orders <= 0) return 0;
    if (orders >= bounds[3]) return 4;
    if (orders >= bounds[2]) return 3;
    if (orders >= bounds[1]) return 2;
    return 1;
  };
  return { size, bounds, stepOf };
};

/** «Eng past sotuv (3+ ta)» — kamida shuncha buyurtmali tumanlar orasida. */
export const SCOPED_LOWEST_MIN = 3;
