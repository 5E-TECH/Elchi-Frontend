import type { DashboardPeriod } from "../../../entities/dashboard/lib/period";
import {
  pendingOf,
  regionsOfLogist,
  shortRegionName,
  successRateOf,
  type RegionItem,
} from "../../../entities/region";

/**
 * LOGIST BOSH SAHIFASI — ma'lumot modeli (LG-1, maket `logist-dashboard-main`).
 *
 * Manba — `GET region/stats/all` (davr `startDate`/`endDate`). Backend logistga hozircha 14 viloyatning hammasini
 * beradi (cheklov — backend iOnGbEqi), shuning uchun logistning o'z viloyatlari klientda `logist_id === me`
 * bo'yicha ajratiladi. Pul (`revenue`) javobda bor, lekin bu modelga KIRMAYDI — logist moliyadan yopiq (ega LG-S1).
 */

export interface LogistRegionRow {
  id: string;
  /** Qisqa nom: «Samarqand viloyati» → «Samarqand». */
  name: string;
  /** To'liq nom («Samarqand viloyati») — «›» havolasining ekran o'quvchi nomi (maket). */
  fullName: string;
  districtCount: number;
  total: number;
  delivered: number;
  cancelled: number;
  /** Jarayonda = jami − sotilgan − bekor. */
  pending: number;
  /** 0..100, sotilgan / qabul qilingan. */
  rate: number;
  /** Buyurtma bor-yo'qligi (yo'q bo'lsa foiz «—»). */
  hasOrders: boolean;
  /** `null` — kuryerlar soni noma'lum (identity javob bermadi): «—». */
  activeCouriers: number | null;
  totalCouriers: number | null;
}

export interface LogistSummary {
  regionCount: number;
  total: number;
  delivered: number;
  cancelled: number;
  pending: number;
  rate: number;
  /** `null` — biror viloyatda kuryerlar soni noma'lum. */
  activeCouriers: number | null;
  totalCouriers: number | null;
}

export interface LogistDashboardModel {
  /** Viloyatlarim — buyurtmalar soni bo'yicha kamayish tartibida (maket jadvali). */
  rows: LogistRegionRow[];
  /** «Viloyatlar muvaffaqiyati» — eng pastdan boshlab; buyurtmasizlar oxirida. */
  bySuccess: LogistRegionRow[];
  summary: LogistSummary;
  /** Eng past / eng yuqori muvaffaqiyat — buyurtmasi bor kamida 2 viloyat bo'lsa. */
  extremes: { lowest: LogistRegionRow; highest: LogistRegionRow } | null;
}

const toRow = (region: RegionItem): LogistRegionRow => {
  const total = region.ordersCount;
  const delivered = region.deliveredOrders;
  const cancelled = region.cancelledOrders;
  const known = region.couriersKnown !== false;
  return {
    id: region.id,
    name: shortRegionName(region.name),
    fullName: region.name,
    districtCount: region.districtCount,
    total,
    delivered,
    cancelled,
    pending: pendingOf(total, delivered, cancelled, region.pendingOrders),
    rate: successRateOf(delivered, total),
    hasOrders: total > 0,
    activeCouriers: known ? region.activeCouriers : null,
    totalCouriers: known ? (region.totalCouriers ?? 0) : null,
  };
};

const sumKnown = (rows: LogistRegionRow[], pick: (row: LogistRegionRow) => number | null): number | null => {
  let sum = 0;
  for (const row of rows) {
    const value = pick(row);
    if (value == null) return null;
    sum += value;
  }
  return sum;
};

export const buildLogistDashboard = (
  regions: readonly RegionItem[],
  logistId: string | number | null | undefined,
): LogistDashboardModel => {
  const rows = regionsOfLogist(regions, logistId).map(toRow);

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const delivered = rows.reduce((sum, row) => sum + row.delivered, 0);
  const cancelled = rows.reduce((sum, row) => sum + row.cancelled, 0);
  const pending = rows.reduce((sum, row) => sum + row.pending, 0);

  const byOrders = [...rows].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "uz"));
  const withOrders = rows.filter((row) => row.hasOrders);
  const ascending = [...withOrders].sort((a, b) => a.rate - b.rate || b.total - a.total);
  const bySuccess = [...ascending, ...rows.filter((row) => !row.hasOrders)];

  return {
    rows: byOrders,
    bySuccess,
    summary: {
      regionCount: rows.length,
      total,
      delivered,
      cancelled,
      pending,
      rate: successRateOf(delivered, total),
      activeCouriers: sumKnown(rows, (row) => row.activeCouriers),
      totalCouriers: sumKnown(rows, (row) => row.totalCouriers),
    },
    extremes:
      ascending.length >= 2 ? { lowest: ascending[0], highest: ascending[ascending.length - 1] } : null,
  };
};

/**
 * So'rov parametrlari: «Barchasi» — sanasiz (backend butun davrni oladi); qolganida aniq kunlar (bo'sh oraliq —
 * bugun, backend sukutiga tayanmaymiz).
 */
export const regionStatsParams = (
  period: { kind: string; range: { from: string; to: string } },
): { startDate?: string; endDate?: string } =>
  period.kind === "all" ? {} : { startDate: period.range.from, endDate: period.range.to };

/**
 * LG-3: «Tafsilot» havolasi — logistning `/regions` ko'rinishi (`?region=<id>`) bosh sahifadagi DAVR bilan (aks holda
 * `/regions` «Bugun» da ochilib, raqamlar boshqacha chiqardi). Bugun · Bu oy · Barchasi — `/regions` ning o'z tezkor
 * davri (oraliqlari bir xil); «Bu hafta» (bosh sahifa — dushanbadan, `/regions` — `dayjs` haftasi), yil va
 * oraliq — aynan shu kunlar bilan `period=custom`.
 */
export const logistRegionHref = (regionId: string, period: Pick<DashboardPeriod, "kind" | "range">): string => {
  const params = new URLSearchParams({ region: regionId });
  if (period.kind === "today" || period.kind === "month" || period.kind === "all") {
    params.set("period", period.kind);
  } else {
    params.set("period", "custom");
    params.set("startDate", period.range.from);
    params.set("endDate", period.range.to);
  }
  return `/regions?${params.toString()}`;
};
