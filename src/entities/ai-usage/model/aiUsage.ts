/**
 * AI XARAJAT PANELI (Celz3rKJ) — backend FRONTEND_CHANGELOG 2026-10-14 «Guruh H» va 2026-10-15 (bot manbasi).
 * Faqat SUPERADMIN / ADMIN (boshqa rol 403).
 *
 *  - `GET /ai-usage/dashboard?fromDate&toDate` (YYYY-MM-DD, Toshkent, ikkala chet ham kiradi; berilmasa oxirgi 30 kun):
 *    `{ from, to, usdUzsRate, summary, byArea, byFeature, byModel, dailySeries, orderSources | null, degraded,
 *    failed_parts }`. `dailySeries[].day` — tayyor Toshkent sanasi (frontendda «epoch + 5 soat» bilan QAYTA
 *    hisoblanmaydi). `orderSources: null` + `degraded` — order-service javob bermadi (xarajat baribir keladi).
 *  - `GET /ai-usage/ai-orders?fromDate&toDate&limit` (1..100): `{ from, to, total, limit, items, degraded }`.
 *    Xarajat DRAFT darajasida (`draftOrders` — bitta AI so'rovdan chiqqan buyurtmalar). Mijoz ismi/telefoni yo'q.
 *
 * Bu fayl — sof normalizatsiya (UI'siz): son satr kelsa ham son, yo'q maydon — 0 yoki `null`.
 */

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nullableNum = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const rows = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.map(asRecord).filter((row): row is UnknownRecord => row !== null) : [];

export interface AiUsageSummary {
  totalCostUsd: number;
  totalCostUzs: number;
  totalCalls: number;
  cacheSavedUsd: number;
  cacheSavedUzs: number;
  aiOrderCount: number;
  orderCostUsd: number;
  orderCostUzs: number;
  avgCostPerAiOrderUsd: number;
  avgCostPerAiOrderUzs: number;
}

export interface AiUsageFeatureRow {
  feature: string;
  area: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costUzs: number;
}

export interface AiUsageModelRow {
  model: string;
  calls: number;
  costUsd: number;
  costUzs: number;
}

export interface AiUsageDay {
  /** `YYYY-MM-DD` — Toshkent kuni (backend SQL'da `AT TIME ZONE 'Asia/Tashkent'`). */
  day: string;
  costUsd: number;
  costUzs: number;
  calls: number;
  aiOrders: number;
}

export const ORDER_SOURCE_KEYS = ["ai", "manual", "bot", "external", "branch"] as const;
export type OrderSourceKey = (typeof ORDER_SOURCE_KEYS)[number];

export interface AiOrderSources {
  total: number;
  counts: Record<OrderSourceKey, number>;
  /** Ulush, % (0–100, backend 1 xona); `total = 0` — hammasi 0. */
  shares: Record<OrderSourceKey, number>;
}

export interface AiUsageDashboard {
  from: string | null;
  to: string | null;
  /** Hozirgi kurs — faqat ma'lumot uchun (so'm qiymati jurnal qatoridagi `cost_uzs`). */
  usdUzsRate: number | null;
  summary: AiUsageSummary;
  byFeature: AiUsageFeatureRow[];
  byModel: AiUsageModelRow[];
  dailySeries: AiUsageDay[];
  /** `null` — order-service javob bermadi (`degraded`), blok joyida xato. */
  orderSources: AiOrderSources | null;
  degraded: boolean;
  failedParts: string[];
}

export interface AiOrderItem {
  orderId: string;
  /** Buyurtma raqami (order-service'dan); olinmasa — `null` («#id»). */
  orderNumber: string | null;
  status: string | null;
  totalPrice: number | null;
  model: string | null;
  createdAt: string | null;
  draftCostUsd: number | null;
  draftCostUzs: number | null;
  /** Shu AI so'rovdan chiqqan buyurtmalar soni (xarajat draft darajasida). */
  draftOrders: number | null;
}

export interface AiOrdersList {
  total: number;
  limit: number;
  items: AiOrderItem[];
  degraded: boolean;
}

/** `{ statusCode, message, data }` o'rami yoki xom obyekt. */
const unwrap = (payload: unknown): UnknownRecord => {
  const root = asRecord(payload) ?? {};
  return asRecord(root.data) ?? root;
};

const readSources = (value: unknown): AiOrderSources | null => {
  const source = asRecord(value);
  if (!source) return null;
  const shares = asRecord(source.shares) ?? {};
  const total = Math.max(0, num(source.total));
  const counts = Object.fromEntries(ORDER_SOURCE_KEYS.map((key) => [key, Math.max(0, num(source[key]))])) as Record<
    OrderSourceKey,
    number
  >;
  const share = (key: OrderSourceKey) => {
    const given = nullableNum(shares[key]);
    if (given != null) return given;
    return total > 0 ? Math.round((counts[key] * 1000) / total) / 10 : 0;
  };
  return {
    total,
    counts,
    shares: Object.fromEntries(ORDER_SOURCE_KEYS.map((key) => [key, share(key)])) as Record<OrderSourceKey, number>,
  };
};

export const normalizeAiUsageDashboard = (payload: unknown): AiUsageDashboard => {
  const data = unwrap(payload);
  const summary = asRecord(data.summary) ?? {};
  const failedRaw = data.failed_parts ?? data.failedParts;
  const failedParts = Array.isArray(failedRaw) ? failedRaw.map(String) : [];
  return {
    from: text(data.from),
    to: text(data.to),
    usdUzsRate: nullableNum(data.usdUzsRate),
    summary: {
      totalCostUsd: num(summary.totalCostUsd),
      totalCostUzs: num(summary.totalCostUzs),
      totalCalls: num(summary.totalCalls),
      cacheSavedUsd: num(summary.cacheSavedUsd),
      cacheSavedUzs: num(summary.cacheSavedUzs),
      aiOrderCount: num(summary.aiOrderCount),
      orderCostUsd: num(summary.orderCostUsd),
      orderCostUzs: num(summary.orderCostUzs),
      avgCostPerAiOrderUsd: num(summary.avgCostPerAiOrderUsd),
      avgCostPerAiOrderUzs: num(summary.avgCostPerAiOrderUzs),
    },
    byFeature: rows(data.byFeature)
      .map((row) => ({
        feature: text(row.feature) ?? "—",
        area: text(row.area),
        calls: num(row.calls),
        inputTokens: num(row.inputTokens),
        outputTokens: num(row.outputTokens),
        costUsd: num(row.costUsd),
        costUzs: num(row.costUzs),
      }))
      .sort((a, b) => b.costUzs - a.costUzs || b.calls - a.calls),
    byModel: rows(data.byModel)
      .map((row) => ({
        model: text(row.model) ?? "—",
        calls: num(row.calls),
        costUsd: num(row.costUsd),
        costUzs: num(row.costUzs),
      }))
      .sort((a, b) => b.costUzs - a.costUzs || b.calls - a.calls),
    dailySeries: rows(data.dailySeries)
      .filter((row) => typeof row.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.day))
      .map((row) => ({
        day: String(row.day),
        costUsd: num(row.costUsd),
        costUzs: num(row.costUzs),
        calls: num(row.calls),
        aiOrders: num(row.aiOrders),
      }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    orderSources: failedParts.includes("orderSources") ? null : readSources(data.orderSources),
    degraded: data.degraded === true || failedParts.length > 0,
    failedParts,
  };
};

export const normalizeAiOrders = (payload: unknown): AiOrdersList => {
  const data = unwrap(payload);
  const items = rows(data.items)
    .map((row) => ({
      orderId: text(row.orderId) ?? "",
      orderNumber: text(row.orderNumber),
      status: text(row.status),
      totalPrice: nullableNum(row.totalPrice),
      model: text(row.model),
      createdAt: text(row.createdAt),
      draftCostUsd: nullableNum(row.draftCostUsd),
      draftCostUzs: nullableNum(row.draftCostUzs),
      draftOrders: nullableNum(row.draftOrders),
    }))
    .filter((item) => item.orderId !== "");
  return {
    total: Math.max(items.length, num(data.total)),
    limit: num(data.limit),
    items,
    degraded: data.degraded === true,
  };
};

/** Kunlar oralig'i (`YYYY-MM-DD`) → so'rov parametrlari (`fromDate` / `toDate`). Bo'sh — backend sukuti (30 kun). */
export const aiUsageParams = (range: { from: string; to: string } | null | undefined) =>
  range?.from && range.to ? { fromDate: range.from, toDate: range.to } : {};
