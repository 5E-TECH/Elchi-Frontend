import { hasFailedPart, type DashboardResponse, type RankingMeta, type TopCourier } from "../../../entities/dashboard";
import type { AppliedRange } from "../../../entities/dashboard/lib/allTime";
import type { DashboardPeriod } from "../../../entities/dashboard/lib/period";
import { normalizeOrderStatus } from "../../../entities/order";
import type { OrderStatus } from "../../../entities/order/types/order";
import {
  getAllTimeRange,
  getThisMonthRange,
  getThisWeekRange,
  getTodayRange,
  type ISODateRange,
} from "../../../shared/lib/dateRange";

/**
 * «FILIAL KO'RSATKICHLARI» (`/branches/:id`, 6CYRjoZG) — sof mantiq (UI'siz).
 *
 * Manba — BITTA so'rov: `GET /analytics/dashboard?branch_id=<id>` (faqat SUPERADMIN/ADMIN; backend
 * FRONTEND_CHANGELOG 2026-10-24, batch D). Javobda filial kesimidagi `orders` (KPI), `previous` va `series`
 * (oldingi teng davr + 14 kunlik seriya, DwrMygfo — delta va sparkline), `dailyRevenue` («Kunlik daromad»),
 * `statusDistribution` (holat → son, donut), `topCouriers` + `topCouriersMeta` (reyting), `branchDashboard`
 * (filial paneli — «x / y faol» kuryerlar) va qo'llangan `branch_id`. Bo'lak olinmasa — `null` +
 * `failed_parts`: o'sha blok nollar bilan emas, xato holati bilan chiziladi.
 */

export type BranchMetricsPeriod = "today" | "week" | "month" | "all";

export const BRANCH_METRICS_PERIODS: readonly BranchMetricsPeriod[] = ["today", "week", "month", "all"];

/** Maket `superadmin-branches-detail` — «Bu hafta» tanlangan. */
export const DEFAULT_BRANCH_METRICS_PERIOD: BranchMetricsPeriod = "week";

/** URL kaliti (`/branches/:id?period=month`); sukut davri URL'ga yozilmaydi. */
export const BRANCH_METRICS_PERIOD_PARAM = "period";

export const parseBranchMetricsPeriod = (value: string | null | undefined): BranchMetricsPeriod =>
  BRANCH_METRICS_PERIODS.find((period) => period === value) ?? DEFAULT_BRANCH_METRICS_PERIOD;

/** Davr → kunlar oralig'i (brauzer kuni; dashboard sana maydonining tez tanlovi bilan bir xil). */
export const branchMetricsRange = (period: BranchMetricsPeriod): ISODateRange => {
  switch (period) {
    case "today":
      return getTodayRange();
    case "week":
      return getThisWeekRange();
    case "month":
      return getThisMonthRange();
    case "all":
      return getAllTimeRange();
  }
};

/** Dashboard davr yordamchilari (`periodLabel`, `comparisonHint`, `previousLabel`) uchun. */
export const toDashboardPeriod = (period: BranchMetricsPeriod): DashboardPeriod => ({
  kind: period,
  range: branchMetricsRange(period),
});

/** So'rov parametrlari: «Barchasi» — `all=true` (backend oxirgi 366 kunga qisqartiradi), aks holda sanalar. */
export const branchMetricsParams = (branchId: string, period: BranchMetricsPeriod) => {
  if (period === "all") return { branch_id: branchId, all: true };
  const range = branchMetricsRange(period);
  return { branch_id: branchId, start_day: range.from, end_day: range.to };
};

// ─── Javobni o'qish ──────────────────────────────────────────────────────────

export interface MetricsTotals {
  acceptedCount: number;
  soldAndPaid: number;
  cancelled: number;
  totalRevenue: number;
  profit: number;
}

export interface MetricsSeriesPoint extends MetricsTotals {
  /** `YYYY-MM-DD` (Toshkent kuni). */
  date: string;
}

export interface DailyRevenuePoint {
  /** `YYYY-MM-DD`. */
  period: string;
  /** Backend yorlig'i: «05.10». */
  label: string;
  revenue: number;
  /** Shu kundagi sotilgan buyurtmalar; kelmasa — `null` («—»). */
  ordersCount: number | null;
}

/** Donut guruhlari (maket tartibi): Sotilgan · Yo'lda · Yangi · Bekor qilingan. */
export interface StatusGroups {
  total: number;
  sold: number;
  road: number;
  fresh: number;
  cancelled: number;
}

export interface BranchCouriersActivity {
  /** Filial kuryerlari soni (`branch_couriers`). */
  total: number;
  /** Bugun faol bo'lganlar (`active_today`). */
  active: number;
}

export interface BranchMetrics {
  current: MetricsTotals;
  /** Oldingi teng davr; «Barchasi»da yoki bo'lak olinmasa — `null` (delta chizilmaydi). */
  previous: MetricsTotals | null;
  /** 14 kunlik seriya (sparkline); 2 nuqtadan kam yoki olinmasa — `null`. */
  series: MetricsSeriesPoint[] | null;
  /** «Kunlik daromad»; bo'lak olinmasa — `null` (blok joyida xato). */
  dailyRevenue: DailyRevenuePoint[] | null;
  /** Holatlar; bo'lak olinmasa — `null`. */
  status: StatusGroups | null;
  /** Kuryerlar reytingi; bo'lak olinmasa — `null`. */
  topCouriers: TopCourier[] | null;
  topCouriersMeta: RankingMeta | null;
  /** «x / y faol» belgisi; filial paneli olinmasa, `stats_unavailable` yoki kuryer yo'q — `null` (belgi yo'q). */
  couriers: BranchCouriersActivity | null;
  /** «Barchasi»: backend qisqartirgan oraliq. */
  appliedRange: AppliedRange | null;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readTotals = (row: UnknownRecord): MetricsTotals => ({
  acceptedCount: toNumber(row.acceptedCount ?? row.accepted_count),
  soldAndPaid: toNumber(row.soldAndPaid ?? row.sold_and_paid),
  cancelled: toNumber(row.cancelled),
  totalRevenue: toNumber(row.totalRevenue ?? row.total_revenue),
  profit: toNumber(row.profit),
});

const readSeries = (value: unknown): MetricsSeriesPoint[] | null => {
  if (!Array.isArray(value)) return null;
  const rows = value
    .map(asRecord)
    .filter((row): row is UnknownRecord => row !== null && typeof row.date === "string" && row.date !== "")
    .map((row) => ({ date: String(row.date), ...readTotals(row) }));
  return rows.length >= 2 ? rows : null;
};

const readDailyRevenue = (value: unknown): DailyRevenuePoint[] | null => {
  const root = asRecord(value);
  if (!root) return null;
  // Backend `{ data: [...], summary }`; ehtiyot uchun ichma-ich `data.data` ham.
  const rows = Array.isArray(root.data) ? root.data : Array.isArray(asRecord(root.data)?.data) ? (asRecord(root.data)?.data as unknown[]) : null;
  if (!rows) return null;
  return rows
    .map(asRecord)
    .filter((row): row is UnknownRecord => row !== null)
    .map((row) => {
      const period = typeof row.period === "string" ? row.period : "";
      const label = typeof row.label === "string" && row.label ? row.label : period;
      return {
        period,
        label,
        revenue: toNumber(row.revenue),
        ordersCount: toOptionalNumber(row.ordersCount ?? row.orders_count),
      };
    })
    .filter((row) => row.label !== "");
};

/**
 * Holat → guruh (backend `soldStatuses` / `cancelledMarketStatuses` bilan bir xil to'plam; ton — `statusRegistry`):
 * sotilgan — sotilgan, to'langan, qisman to'langan; bekor — bekor qilingan, bekor (jo'natilgan), marketga
 * topshirildi, yopilgan; yangi (kuryerga biriktirilmagan) — yangi, yaratilgan, qabul qilindi; qolgani
 * (yo'lda, kutilmoqda, mijoz kutilmoqda va noma'lum holat) — «Yo'lda». Yig'indi `total` ga teng.
 */
const SOLD: ReadonlySet<OrderStatus> = new Set<OrderStatus>(["sold", "paid", "partly_paid"]);
const FRESH: ReadonlySet<OrderStatus> = new Set<OrderStatus>(["new", "created", "received"]);
const CANCELLED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "cancelled",
  "cancelled (sent)",
  "returned_to_market",
  "closed",
]);

export const groupStatusDistribution = (value: unknown): StatusGroups | null => {
  const root = asRecord(value);
  const distribution = asRecord(root?.distribution);
  if (!root || !distribution) return null;
  let sum = 0;
  let sold = 0;
  let fresh = 0;
  let cancelled = 0;
  for (const [key, raw] of Object.entries(distribution)) {
    const count = Math.max(0, toNumber(raw));
    if (count === 0) continue;
    sum += count;
    const status = normalizeOrderStatus(key);
    if (status && SOLD.has(status)) sold += count;
    else if (status && FRESH.has(status)) fresh += count;
    else if (status && CANCELLED.has(status)) cancelled += count;
  }
  const declared = toOptionalNumber(root.total);
  const total = declared != null && declared >= sum ? declared : sum;
  return { total, sold, fresh, cancelled, road: Math.max(0, total - sold - fresh - cancelled) };
};

/**
 * Javob → bo'lim ma'lumoti. Backend so'ralgan filialni qo'llamagan bo'lsa (`branch_id` qaytmadi yoki boshqa —
 * masalan `branch_id` ni bilmaydigan eski backend kompaniya raqamlarini beradi) — `null`: kompaniya raqamlari
 * filialniki bo'lib ko'rinmasin.
 */
export const readBranchMetrics = (response: DashboardResponse | undefined, branchId: string): BranchMetrics | null => {
  const data = response?.data;
  if (!data) return null;
  const raw = data as unknown as UnknownRecord;
  if (raw.branch_id == null || String(raw.branch_id) !== String(branchId)) return null;
  const failed = data.failedParts;

  const previousRecord = hasFailedPart(failed, "trend") ? null : asRecord(raw.previous);
  const branchDashboard = hasFailedPart(failed, "branchDashboard") ? null : data.branchDashboard;
  const courierCard = branchDashboard && branchDashboard.stats_unavailable !== true ? branchDashboard.cards?.couriers : null;
  const courierTotal = toNumber(courierCard?.total);

  return {
    current: {
      acceptedCount: toNumber(data.orders?.acceptedCount),
      soldAndPaid: toNumber(data.orders?.soldAndPaid),
      cancelled: toNumber(data.orders?.cancelled),
      totalRevenue: toNumber(data.orders?.totalRevenue),
      profit: toNumber(data.orders?.profit),
    },
    previous: previousRecord ? readTotals(previousRecord) : null,
    series: hasFailedPart(failed, "trend") ? null : readSeries(raw.series),
    dailyRevenue: hasFailedPart(failed, "dailyRevenue") ? null : readDailyRevenue(raw.dailyRevenue),
    status: hasFailedPart(failed, "statusDistribution") ? null : groupStatusDistribution(raw.statusDistribution),
    // `failedParts` ga `null` kelgan bo'lak ham kiradi (`readPartialFailure`, `DASHBOARD_PARTS`).
    topCouriers: hasFailedPart(failed, "topCouriers") ? null : (data.topCouriers ?? []),
    topCouriersMeta: data.topCouriersMeta ?? null,
    couriers:
      courierCard && courierTotal > 0
        ? { total: courierTotal, active: Math.min(courierTotal, Math.max(0, toNumber(courierCard.active))) }
        : null,
    appliedRange: data.appliedRange ?? null,
  };
};

/** Davrda hech narsa yo'q (qabul, sotuv, bekor, daromad — hammasi 0): bo'lim bo'sh holatda. */
export const isEmptyPeriod = ({ current }: Pick<BranchMetrics, "current">): boolean =>
  current.acceptedCount === 0 && current.soldAndPaid === 0 && current.cancelled === 0 && current.totalRevenue === 0;
