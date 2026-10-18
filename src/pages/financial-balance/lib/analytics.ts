/**
 * Balans → Tahlil: `GET finance/financial-balance/analytics` va `…/top-impacts` javoblarini
 * o'qish hamda «Daftar qoldig'i harakati» (sharshara) hisobi. Sof funksiyalar — test qilinadi.
 *
 * Backend (`financialBalanceAnalytics`, origin/main): `{ currentBalance, summary: { totalPositive,
 * totalNegative, netChange, totalCount }, positiveImpact[], negativeImpact[] }` — har ta'sir
 * `{ source_type, total_amount, transaction_count, percentage }`. `top-impacts` — server
 * sahifalashi (`limit` 1..100), `{ items[], pagination: { total, page, limit, totalPages } }`.
 */

import { toFinancialNumber } from "./financialBalance";
import { toActorName, toHistoryText } from "./historyRow";

type UnknownRecord = Record<string, unknown>;

const getRecord = (value: unknown): UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : {};

const getPayload = (value: unknown) => {
  const response = getRecord(value);
  return getRecord(response.data ?? response);
};

const getArray = (source: UnknownRecord, keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export interface LedgerRow {
  id: string;
  date: unknown;
  sourceType: string;
  /** Tizim yozgan (`created_by` yo'q) — «Avtomatik». */
  automatic: boolean;
  /** Kim kiritgan: ism, bo'lmasa `#id` (top-impacts javobida ism yo'q — `#id`). */
  actor: string;
  amount: number;
  signedAmount: number;
}

export interface SourceBucket {
  sourceType: string;
  amount: number;
  /** Shu yo'nalishdagi jamidan ulush, 0..100. */
  percent: number;
}

export interface AnalyticsSummary {
  positiveTotal: number;
  negativeTotal: number;
  netTotal: number;
  totalCount: number;
}

const getSignedAmount = (record: UnknownRecord) => {
  const amount = Math.abs(toFinancialNumber(record.amount ?? record.total_amount ?? record.totalAmount));
  const before = toFinancialNumber(record.balance_before ?? record.balanceBefore);
  const after = toFinancialNumber(record.balance_after ?? record.balanceAfter);

  if (before !== after) {
    return after - before;
  }

  const operationType = String(record.operation_type ?? record.operationType ?? "").toLowerCase();
  const sourceType = String(record.source_type ?? record.sourceType ?? "").toLowerCase();

  if (operationType === "expense" || ["manual_expense", "salary", "correction"].includes(sourceType)) {
    return -amount;
  }

  return amount;
};

export const normalizeLedgerRows = (items: unknown[]): LedgerRow[] =>
  items.map((item, index) => {
    const record = getRecord(item);
    return {
      id: String(record.id ?? index),
      date: record.payment_date ?? record.paymentDate ?? record.createdAt ?? record.created_at ?? "",
      sourceType: String(record.source_type ?? record.sourceType ?? ""),
      automatic: !toHistoryText(record.created_by),
      actor: toActorName(record),
      amount: Math.abs(toFinancialNumber(record.amount ?? record.total_amount ?? record.totalAmount)),
      signedAmount: getSignedAmount(record),
    };
  });

export const normalizeApiBuckets = (response: unknown, direction: "positive" | "negative"): SourceBucket[] => {
  const payload = getPayload(response);
  const rows = getArray(
    payload,
    direction === "positive"
      ? ["positiveImpact", "positive_impact", "positiveSources", "positive_sources"]
      : ["negativeImpact", "negative_impact", "negativeSources", "negative_sources"],
  );

  return rows
    .map((item) => {
      const record = getRecord(item);
      return {
        sourceType: String(record.source_type ?? record.sourceType ?? record.type ?? ""),
        amount: Math.abs(toFinancialNumber(record.total_amount ?? record.totalAmount ?? record.amount)),
        percent: toFinancialNumber(record.percentage ?? record.percent),
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Davr jamlari — faqat analytics agregatidan. Zaxira yo'q: top-impacts endi bitta sahifa (10 qator) beradi,
 * undan jami yasash noto'g'ri bo'lardi (vmLTsAok); maydon yo'q bo'lsa — 0.
 */
export const normalizeAnalyticsSummary = (response: unknown): AnalyticsSummary => {
  const payload = getPayload(response);
  const summary = getRecord(payload.summary);
  const positiveTotal = toFinancialNumber(summary.totalPositive ?? summary.total_positive ?? payload.totalPositive);
  const negativeTotal = toFinancialNumber(summary.totalNegative ?? summary.total_negative ?? payload.totalNegative);
  const netTotal = toFinancialNumber(summary.netChange ?? summary.net_change ?? payload.netChange);
  const totalCount = toFinancialNumber(summary.totalCount ?? summary.total_count ?? payload.totalCount);

  return { positiveTotal, negativeTotal, netTotal, totalCount };
};

/* ─── «Daftar qoldig'i harakati» — sharshara ──────────────────────────────── */

export type WaterfallKind = "start" | "up" | "down" | "end";

export interface WaterfallStep {
  key: string;
  kind: WaterfallKind;
  /** `start`/`end` — `null`; ta'sir — manba turi. */
  sourceType: string | null;
  /** Ishorali o'zgarish (`start`/`end` da — qoldiqning o'zi). */
  amount: number;
  /** Ustun pastki va yuqori darajasi (so'm). */
  from: number;
  to: number;
}

export interface Waterfall {
  steps: WaterfallStep[];
  /** O'q chegaralari (0 har doim ichida). */
  min: number;
  max: number;
  /** Davr boshi va oxiri (`Hozir`) chizildimi. */
  withTotals: boolean;
}

/**
 * Davr boshi = hozirgi qoldiq − sof o'zgarish (maket izohi). Bu faqat davr BUGUNGACHA davom etsa
 * to'g'ri: o'tgan davrda undan keyingi yozuvlar ham hozirgi qoldiqqa kirgan — shunda (va
 * `currentBalance` yo'q bo'lsa) boshi/oxiri chizilmaydi, faqat ta'sirlar noldan yig'iladi.
 */
export const buildWaterfall = (input: {
  currentBalance: number | null;
  netChange: number;
  positive: SourceBucket[];
  negative: SourceBucket[];
  /** Davr bugungacha (yoki «Barchasi»). */
  reachesToday: boolean;
}): Waterfall => {
  const withTotals = input.currentBalance !== null && input.reachesToday;
  const start = withTotals ? (input.currentBalance as number) - input.netChange : 0;
  const steps: WaterfallStep[] = [];
  let level = start;

  if (withTotals) steps.push({ key: "start", kind: "start", sourceType: null, amount: start, from: 0, to: start });
  for (const bucket of input.positive) {
    steps.push({
      key: `up:${bucket.sourceType}`,
      kind: "up",
      sourceType: bucket.sourceType,
      amount: bucket.amount,
      from: level,
      to: level + bucket.amount,
    });
    level += bucket.amount;
  }
  for (const bucket of input.negative) {
    steps.push({
      key: `down:${bucket.sourceType}`,
      kind: "down",
      sourceType: bucket.sourceType,
      amount: -bucket.amount,
      from: level,
      to: level - bucket.amount,
    });
    level -= bucket.amount;
  }
  if (withTotals) {
    const end = input.currentBalance as number;
    steps.push({ key: "end", kind: "end", sourceType: null, amount: end, from: 0, to: end });
  }

  const levels = steps.flatMap((step) => [step.from, step.to]);
  return {
    steps,
    min: Math.min(0, ...levels),
    max: Math.max(0, ...levels),
    withTotals,
  };
};

/** Darajaning o'qdagi o'rni, pastdan foizda (0..100). */
export const toPlotPercent = (value: number, min: number, max: number) =>
  max === min ? 0 : ((value - min) / (max - min)) * 100;

/** Top-impacts sahifalashi (server). */
export const readTopImpactsPagination = (response: unknown, fallbackPage: number, fallbackLimit: number) => {
  const payload = getPayload(response);
  const pagination = getRecord(payload.pagination ?? payload.meta);
  const toPositive = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
  };
  return {
    total: toPositive(pagination.total ?? payload.total, 0),
    page: toPositive(pagination.page, fallbackPage) || fallbackPage,
    limit: toPositive(pagination.limit, fallbackLimit) || fallbackLimit,
  };
};
