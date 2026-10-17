import {
  pendingOf,
  shortRegionName,
  successRateOf,
  type RegionItem,
  type RegionSummary,
} from "../../../entities/region";

/**
 * `/regions` (superadmin/admin) hisob-kitoblari: `GET region/stats/all` qatorlari → xarita, reyting,
 * KPI, xulosa. Backend qatorida «jarayonda» va foiz yo'q — shu yerda hisoblanadi.
 */

export type RegionMetric = "orders" | "success" | "revenue";

export interface RegionRow {
  id: string;
  name: string;
  /** «Toshkent sh.», «Samarqand». */
  short: string;
  /** Highcharts xarita kaliti (`uz-sa`), topilmasa `null` — xaritada chizilmaydi, ro'yxatda bor. */
  hcKey: string | null;
  orders: number;
  sold: number;
  cancelled: number;
  pending: number;
  revenue: number;
  /** 0..100 */
  rate: number;
  districts: number;
  couriers: number;
  couriersKnown: boolean;
  item: RegionItem;
}

/** Viloyat nomi → Highcharts `uz-all` kaliti (eski xarita moslashtirishi aynan). */
const NAME_TO_HC_KEY: Record<string, string> = {
  andijon: "uz-an",
  buxoro: "uz-bu",
  jizzax: "uz-ji",
  qashqadaryo: "uz-qa",
  navoiy: "uz-nw",
  namangan: "uz-ng",
  samarqand: "uz-sa",
  surxondaryo: "uz-su",
  sirdaryo: "uz-si",
  toshkentsh: "uz-tk",
  toshkentshahri: "uz-tk",
  toshkent: "uz-ta",
  toshkentviloyati: "uz-ta",
  fargona: "uz-fa",
  xorazm: "uz-kh",
  qoraqalpogiston: "uz-qr",
};

/** Reyting avatari (maket: «TSh», «TV», «SM» …) — xarita kaliti bo'yicha. */
const HC_KEY_AVATAR: Record<string, string> = {
  "uz-tk": "TSh",
  "uz-ta": "TV",
  "uz-sa": "SM",
  "uz-fa": "FR",
  "uz-an": "AN",
  "uz-bu": "BX",
  "uz-ng": "NM",
  "uz-qa": "QD",
  "uz-su": "SX",
  "uz-kh": "XR",
  "uz-ji": "JZ",
  "uz-si": "SR",
  "uz-nw": "NV",
  "uz-qr": "QR",
};

export const normalizeRegionName = (value: string) => {
  const normalized = value
    .toLocaleLowerCase()
    .replace(/[ʻʼ‘’`]/g, "'")
    .replace(/o'/g, "o")
    .replace(/g'/g, "g")
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalized.includes("toshkent shahri") ||
    normalized === "toshkent shahar" ||
    normalized === "toshkent sh."
  ) {
    return "toshkentshahri";
  }
  if (normalized.includes("toshkent viloyati") || normalized === "toshkent vil.") {
    return "toshkentviloyati";
  }
  return normalized
    .replace(/respublikasi|viloyati|viloyat|shahar/g, "")
    .replace(/[\s.]+/g, "")
    .trim();
};

export const hcKeyOf = (name: string): string | null =>
  NAME_TO_HC_KEY[normalizeRegionName(name)] ?? null;

export const regionAvatar = (row: Pick<RegionRow, "hcKey">): string | undefined =>
  row.hcKey ? HC_KEY_AVATAR[row.hcKey] : undefined;

export const toRegionRows = (regions: RegionItem[]): RegionRow[] =>
  regions
    .map((item) => {
      const orders = Math.max(0, item.ordersCount);
      const sold = Math.max(0, item.deliveredOrders);
      const cancelled = Math.max(0, item.cancelledOrders);
      const hcKey = hcKeyOf(item.name);
      return {
        id: item.id,
        name: item.name,
        short: shortRegionName(item.name),
        hcKey,
        orders,
        sold,
        cancelled,
        pending: pendingOf(orders, sold, cancelled, item.pendingOrders),
        revenue: Math.max(0, item.totalRevenue),
        rate: successRateOf(sold, orders),
        districts: Math.max(0, item.districtCount),
        couriers: Math.max(0, item.activeCouriers),
        couriersKnown: item.couriersKnown !== false,
        item,
      };
    })
    .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));

/** Rang pog'onasi: 0 — buyurtma yo'q, 1..4 — `region-map-low … xhigh` (4 ta token). */
export type MapStep = 0 | 1 | 2 | 3 | 4;

/** Buyurtmalar: 1–9 · 10–29 · 30–79 · 80+ (dashboard kartogrammasi bilan bir xil shkala). */
export const ORDER_STEPS = [10, 30, 80] as const;
/** Muvaffaqiyat: 40% dan kam · 40–59% · 60–74% · 75%+. */
export const SUCCESS_STEPS = [40, 60, 75] as const;

export const mapStepOf = (row: RegionRow, metric: RegionMetric, maxRevenue: number): MapStep => {
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

/** Pog'ona → katak/legenda klassi (`--color-region-map-*`; `--seq-*` ilovada yo'q). */
export const STEP_CLASS: Record<MapStep, string> = {
  0: "bg-sunken",
  1: "bg-region-map-low",
  2: "bg-region-map-medium",
  3: "bg-region-map-high",
  4: "bg-region-map-xhigh",
};

/** Pog'ona → CSS o'zgaruvchisi (Highcharts rangi `getComputedStyle` orqali o'qiladi). */
export const STEP_VAR: Record<MapStep, string> = {
  0: "--color-sunken",
  1: "--color-region-map-low",
  2: "--color-region-map-medium",
  3: "--color-region-map-high",
  4: "--color-region-map-xhigh",
};

/** «Eng past muvaffaqiyat (5+ ta)» — kamida shuncha buyurtmali viloyatlar orasida. */
export const LOWEST_MIN_ORDERS = 5;
/** Yaxshi zona chegarasi (`tizim-charts`). */
export const GOOD_ZONE = 70;

export interface RegionsSummary {
  total: number;
  sold: number;
  cancelled: number;
  pending: number;
  revenue: number;
  rate: number;
  /** Buyurtmasi bor viloyatlar. */
  active: RegionRow[];
  top?: RegionRow;
  topRevenue?: RegionRow;
  lowest?: RegionRow;
  /** Kuryerlar soni ma'lum bo'lmasa `null` (backend identity javob bermadi). */
  couriers: number | null;
  districts: number;
  good: RegionRow[];
  below: RegionRow[];
  /** Ma'lumot hali kam (1..4 ta buyurtma). */
  lowData: RegionRow[];
  maxOrders: number;
  maxRevenue: number;
}

export const summarizeRegions = (
  rows: RegionRow[],
  summary?: RegionSummary | null,
): RegionsSummary => {
  const sum = (pick: (row: RegionRow) => number) => rows.reduce((acc, row) => acc + pick(row), 0);
  const total = summary?.totalOrders || sum((row) => row.orders);
  const sold = summary?.totalDelivered || sum((row) => row.sold);
  const cancelled = summary?.totalCancelled || sum((row) => row.cancelled);
  const revenue = summary?.totalRevenue || sum((row) => row.revenue);
  const active = rows.filter((row) => row.orders > 0);
  const byRevenue = [...active].sort((a, b) => b.revenue - a.revenue);
  const lowest = active
    .filter((row) => row.orders >= LOWEST_MIN_ORDERS)
    .sort((a, b) => a.rate - b.rate || b.orders - a.orders)[0];
  const couriersKnown = rows.length > 0 && rows.every((row) => row.couriersKnown);
  return {
    total,
    sold,
    cancelled,
    pending: pendingOf(total, sold, cancelled),
    revenue,
    rate: successRateOf(sold, total),
    active,
    top: active[0],
    topRevenue: byRevenue[0]?.revenue > 0 ? byRevenue[0] : undefined,
    lowest,
    couriers: couriersKnown ? sum((row) => row.couriers) : null,
    districts: sum((row) => row.districts),
    good: active.filter((row) => row.rate >= GOOD_ZONE),
    below: active.filter((row) => row.rate < GOOD_ZONE).sort((a, b) => a.rate - b.rate),
    lowData: active.filter((row) => row.orders < LOWEST_MIN_ORDERS),
    maxOrders: active[0]?.orders ?? 0,
    maxRevenue: byRevenue[0]?.revenue ?? 0,
  };
};

/** HTML matnini xavfsiz qilish (Highcharts tooltip — `useHTML`). */
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
