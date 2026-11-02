/**
 * Bosh sahifadagi «Analitika KPI» — javob shakli (backend `origin/main`):
 *
 *  GET analytics/kpi → `{ statusCode, message, data: { averageOrderValue, averageFulfillmentHours, onTimeRate,
 *                       cancellationRate, courierEfficiency, marketRating[], marketRatingMeta, degraded, failed_parts } }`
 *                       (`analytics-service.service.ts` — foizlar 0–100, `courierEfficiency` — kuryerga o'rtacha
 *                       buyurtma SONI, foiz emas: spec §8 D3);
 */

export type AnalyticsKpi = {
  averageOrderValue: number;
  averageFulfillmentHours: number;
  onTimeRate: number;
  /** Davrda yetkazilganlar soni; `0` — SLA o\'lchanmagan, `null` — backend bermadi. */
  deliveryCount?: number | null;
  cancellationRate: number;
  courierEfficiency: number;
  marketRating: Array<Record<string, unknown>>;
  degraded: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toNumber = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const unwrap = (payload: unknown): Record<string, unknown> => {
  const record = asRecord(payload);
  if ("data" in record && ("statusCode" in record || "message" in record)) return asRecord(record.data);
  return record;
};

export const readAnalyticsKpi = (payload: unknown): AnalyticsKpi | null => {
  const data = unwrap(payload);
  const known = ["averageOrderValue", "averageFulfillmentHours", "onTimeRate", "cancellationRate", "courierEfficiency"];
  if (!known.some((key) => key in data)) return null;
  return {
    averageOrderValue: toNumber(data.averageOrderValue),
    averageFulfillmentHours: toNumber(data.averageFulfillmentHours),
    onTimeRate: toNumber(data.onTimeRate),
    // yrLt5oMi: `0` — davrda yetkazish yo'q, SLA o'lchanmagan; maydon yo'q — `null`.
    deliveryCount:
      data.deliveryCount === undefined || data.deliveryCount === null ? null : Math.max(0, toNumber(data.deliveryCount)),
    cancellationRate: toNumber(data.cancellationRate),
    courierEfficiency: toNumber(data.courierEfficiency),
    marketRating: Array.isArray(data.marketRating) ? data.marketRating.map(asRecord) : [],
    degraded: data.degraded === true,
  };
};

/** Soat (kasr) → «18 soat 24 daq» uchun butun soat va daqiqa. */
export const splitHours = (hours: number) => {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
};

/** Market nomi (reyting qatori shakli servisga qarab farq qiladi). */
export const ratingName = (row: Record<string, unknown>) => {
  const value = row.name ?? row.market_name ?? row.marketName ?? asRecord(row.market).name;
  return value == null ? "" : String(value);
};
