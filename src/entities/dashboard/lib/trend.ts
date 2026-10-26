/**
 * OLDINGI DAVR VA 14 KUNLIK SERIYA (DwrMygfo), MAQSAD (l9NNdsCH) — `GET /analytics/dashboard` va `GET /analytics/kpi`
 * javoblaridagi qo'shimcha bo'laklar (backend FRONTEND_CHANGELOG 2026-10-24, batch D).
 *
 *  - dashboard: `previous: { from, to, acceptedCount, soldAndPaid, cancelled, totalRevenue, profit, lostRevenue } | null`
 *    (joriy oynadan oldingi teng oyna; «Barchasi»da `null`), `series: [{ date, …shu maydonlar }]` (joriy oyna oxiri
 *    bilan tugaydigan 14 Toshkent kuni), `targets: { successRate }`. Registratorda moliyaviy maydonlar yo'q.
 *  - kpi: `previous: { from, to, averageOrderValue, averageFulfillmentHours, onTimeRate, deliveryCount,
 *    cancellationRate } | null`, `series: [{ date, …shu KPI }]`.
 *  - bo'lak olinmasa — `previous: null`, `series: null`, `failed_parts: ['trend']` (delta va sparkline chizilmaydi,
 *    0 bilan solishtirilmaydi).
 *
 * Ikkinchi og'ir `analytics/dashboard` / `analytics/kpi` so'rovi (oldingi davr uchun) endi kerak emas.
 */

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Son (0 ham) yoki `null` — maydon yo'q (masalan registratorda moliyaviy maydon) yoki son emas. */
export const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Dashboard oldingi davr / seriya qiymatlari. Moliyaviy maydon kelmasa (registrator) — `null`. */
export interface DashboardTrendTotals {
  acceptedCount: number;
  soldAndPaid: number;
  cancelled: number;
  totalRevenue: number | null;
  profit: number | null;
  lostRevenue: number | null;
}

export interface DashboardPrevious extends DashboardTrendTotals {
  from: string | null;
  to: string | null;
}

export interface DashboardSeriesPoint extends DashboardTrendTotals {
  /** `YYYY-MM-DD` (Toshkent kuni). */
  date: string;
}

export interface KpiTrendValues {
  averageOrderValue: number;
  averageFulfillmentHours: number;
  onTimeRate: number;
  /** `null` — backend bermadi. */
  deliveryCount: number | null;
  cancellationRate: number;
}

export interface KpiPrevious extends KpiTrendValues {
  from: string | null;
  to: string | null;
}

export interface KpiSeriesPoint extends KpiTrendValues {
  date: string;
}

export interface DashboardTargets {
  /** Muvaffaqiyat ulushi maqsadi, % (0..100). */
  successRate: number | null;
}

const readDashboardTotals = (row: UnknownRecord): DashboardTrendTotals => ({
  acceptedCount: toNumber(row.acceptedCount ?? row.accepted_count),
  soldAndPaid: toNumber(row.soldAndPaid ?? row.sold_and_paid),
  cancelled: toNumber(row.cancelled),
  totalRevenue: toNullableNumber(row.totalRevenue ?? row.total_revenue),
  profit: toNullableNumber(row.profit),
  lostRevenue: toNullableNumber(row.lostRevenue ?? row.lost_revenue),
});

const readKpiValues = (row: UnknownRecord): KpiTrendValues => ({
  averageOrderValue: toNumber(row.averageOrderValue ?? row.average_order_value),
  averageFulfillmentHours: toNumber(row.averageFulfillmentHours ?? row.average_fulfillment_hours),
  onTimeRate: toNumber(row.onTimeRate ?? row.on_time_rate),
  deliveryCount: toNullableNumber(row.deliveryCount ?? row.delivery_count),
  cancellationRate: toNumber(row.cancellationRate ?? row.cancellation_rate),
});

/** Seriya qatorlari (sanasi bor), sana bo'yicha tartiblangan; 2 nuqtadan kam — `null` (chiziq chizilmaydi). */
const readSeries = <T>(value: unknown, read: (row: UnknownRecord) => T): Array<T & { date: string }> | null => {
  if (!Array.isArray(value)) return null;
  const rows = value
    .map(asRecord)
    .filter((row): row is UnknownRecord => row !== null && toText(row.date) !== null)
    .map((row) => ({ ...read(row), date: toText(row.date) as string }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return rows.length >= 2 ? rows : null;
};

const trendFailed = (failedParts: readonly string[] | undefined) => Boolean(failedParts?.includes("trend"));

/** Dashboard `previous`; bo'lak olinmagan (`failed_parts: trend`) yoki yo'q — `null`. */
export const readDashboardPrevious = (data: UnknownRecord, failedParts?: readonly string[]): DashboardPrevious | null => {
  const row = trendFailed(failedParts) ? null : asRecord(data.previous);
  if (!row) return null;
  return { from: toText(row.from), to: toText(row.to), ...readDashboardTotals(row) };
};

export const readDashboardSeries = (data: UnknownRecord, failedParts?: readonly string[]): DashboardSeriesPoint[] | null =>
  trendFailed(failedParts) ? null : readSeries(data.series, readDashboardTotals);

export const readKpiPrevious = (data: UnknownRecord, failedParts?: readonly string[]): KpiPrevious | null => {
  const row = trendFailed(failedParts) ? null : asRecord(data.previous);
  if (!row) return null;
  return { from: toText(row.from), to: toText(row.to), ...readKpiValues(row) };
};

export const readKpiSeries = (data: UnknownRecord, failedParts?: readonly string[]): KpiSeriesPoint[] | null =>
  trendFailed(failedParts) ? null : readSeries(data.series, readKpiValues);

/** `targets.successRate` (0..100); yo'q yoki noto'g'ri — `null` (maqsad chizilmaydi). */
export const readDashboardTargets = (data: UnknownRecord): DashboardTargets | null => {
  const targets = asRecord(data.targets);
  if (!targets) return null;
  const rate = toNullableNumber(targets.successRate ?? targets.success_rate);
  return { successRate: rate != null && rate > 0 && rate <= 100 ? rate : null };
};

/**
 * Seriyadan bitta ko'rsatkich qiymatlari (sparkline uchun). Biror nuqtada qiymat yo'q bo'lsa (`null` — masalan
 * registratorda moliyaviy maydon) — `null`: yarim chiziq chizilmaydi.
 */
export const seriesValues = <T extends { date: string }>(
  series: readonly T[] | null | undefined,
  pick: (point: T) => number | null | undefined,
): number[] | null => {
  if (!series || series.length < 2) return null;
  const values: number[] = [];
  for (const point of series) {
    const value = pick(point);
    if (value == null || !Number.isFinite(value)) return null;
    values.push(value);
  }
  return values;
};
