/**
 * «Tizim» tabi — javob shakllari (backend `origin/main`):
 *
 *  GET analytics/kpi → `{ statusCode, message, data: { averageOrderValue, averageFulfillmentHours, onTimeRate,
 *                       cancellationRate, courierEfficiency, marketRating[], marketRatingMeta, degraded, failed_parts } }`
 *                       (`analytics-service.service.ts` — foizlar 0–100, `courierEfficiency` — kuryerga o'rtacha
 *                       buyurtma SONI, foiz emas: spec §8 D3);
 *  GET scan/:token   → `{ type: "order" | "batch" | "post" | "market_cancelled_handover", data: {...} }`; topilmasa 404.
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

export type ScanFieldKind = "text" | "money" | "date" | "phone" | "count" | "status";

/** Natijada ko'rsatiladigan maydonlar — maket tartibida. Boshqa maydonlar chizilmaydi. */
export const SCAN_FIELDS: ReadonlyArray<{ key: string; kind: ScanFieldKind }> = [
  { key: "id", kind: "text" },
  { key: "qr_code_token", kind: "text" },
  { key: "name", kind: "text" },
  { key: "status", kind: "status" },
  { key: "customer_name", kind: "text" },
  { key: "phone_number", kind: "phone" },
  { key: "from_branch", kind: "text" },
  { key: "source_branch", kind: "text" },
  { key: "to_branch", kind: "text" },
  { key: "destination_branch", kind: "text" },
  { key: "region", kind: "text" },
  { key: "district", kind: "text" },
  { key: "market", kind: "text" },
  { key: "courier", kind: "text" },
  { key: "orders_count", kind: "count" },
  { key: "order_count", kind: "count" },
  { key: "total_amount", kind: "money" },
  { key: "total_price", kind: "money" },
  { key: "amount", kind: "money" },
  { key: "created_at", kind: "date" },
  { key: "createdAt", kind: "date" },
];

export type ScanResult = {
  type: string;
  fields: Array<{ key: string; kind: ScanFieldKind; value: string | number }>;
};

/** Ichma-ich obyekt (filial, market, kuryer) — nomi; oddiy qiymat — o'zi. */
const scalar = (value: unknown): string | number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "boolean") return null;
  const record = asRecord(value);
  const name = record.name ?? record.title;
  return name == null || name === "" ? null : String(name);
};

export const readScanResult = (payload: unknown): ScanResult | null => {
  const root = asRecord(payload);
  if (!("type" in root)) return null;
  const data = asRecord(root.data);
  const fields: ScanResult["fields"] = [];
  const seenLabels = new Set<string>();
  for (const field of SCAN_FIELDS) {
    let raw: unknown = data[field.key];
    if (raw === undefined && field.kind === "count" && field.key === "orders_count" && Array.isArray(data.orders)) {
      raw = data.orders.length;
    }
    const value = scalar(raw);
    if (value === null) continue;
    // Bir xil ma'noli muqobil kalitlar (from_branch / source_branch …) ikki marta chiqmasin.
    const group = SCAN_LABEL_GROUP[field.key] ?? field.key;
    if (seenLabels.has(group)) continue;
    seenLabels.add(group);
    fields.push({ key: field.key, kind: field.kind, value });
  }
  return { type: String(root.type), fields };
};

const SCAN_LABEL_GROUP: Record<string, string> = {
  source_branch: "from_branch",
  destination_branch: "to_branch",
  order_count: "orders_count",
  total_price: "total_amount",
  amount: "total_amount",
  createdAt: "created_at",
};

/** Paket holati (`PENDING|SENT|RECEIVED|CANCELLED`) → `BatchStatus` kaliti. */
export const toBatchStatusKey = (status: string) => {
  const value = status.toLowerCase();
  if (value === "pending" || value === "new") return "new";
  if (value === "sent" || value === "on_the_way") return "on_the_way";
  if (value === "received") return "received";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return null;
};
