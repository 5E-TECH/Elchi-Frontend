import type { PaymentsMetaResponse } from "../../../../entities/payments";

/**
 * uzWcMR1C — `GET /finance/cashbox/payments-meta` javobini KPI kartalari uchun o'qish. Javob bermagan yoki noto'g'ri
 * shakldagi blok `null` bo'ladi (0 emas): karta o'sha sanoqni chizmaydi, yolg'on «0 ta» chiqmaydi.
 */
export type PaymentsMetaTotals = { count: number; amount: number };

export type PaymentsMetaMarket = { marketId: string; name: string | null; amount: number; share: number };

export type PaymentsMetaPayable = {
  marketsCount: number;
  /** Bitta qator buzuq bo'lsa — bo'sh (ulushlar yig'indisi chalkashmasin): soni qoladi, taqsimot chizilmaydi. */
  topMarkets: PaymentsMetaMarket[];
  /** «Yana N ta»; qolgan market bo'lmasa `null`. */
  others: (PaymentsMetaTotals & { share: number }) | null;
};

export type PaymentsMeta = {
  branches: PaymentsMetaTotals | null;
  hqCouriers: PaymentsMetaTotals | null;
  payable: PaymentsMetaPayable | null;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const parseTotals = (value: unknown): PaymentsMetaTotals | null => {
  const record = asRecord(value);
  const count = finite(record.count);
  const amount = finite(record.amount);
  return count !== null && amount !== null ? { count, amount } : null;
};

const parseMarket = (value: unknown): PaymentsMetaMarket | null => {
  const record = asRecord(value);
  const amount = finite(record.amount);
  const share = finite(record.share);
  if (amount === null || share === null) return null;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  return { marketId: String(record.market_id), name: name || null, amount, share };
};

const parsePayable = (value: unknown): PaymentsMetaPayable | null => {
  const record = asRecord(value);
  const marketsCount = finite(record.markets_count);
  if (marketsCount === null) return null;
  const rows = Array.isArray(record.top_markets) ? record.top_markets.map(parseMarket) : [];
  const topMarkets = rows.filter((row) => row !== null);
  const others = parseTotals(record.others);
  const othersShare = finite(asRecord(record.others).share);
  return {
    marketsCount,
    topMarkets: topMarkets.length === rows.length ? topMarkets : [],
    others: others && others.count > 0 && othersShare !== null ? { ...others, share: othersShare } : null,
  };
};

export const normalizePaymentsMeta = (response: PaymentsMetaResponse | undefined): PaymentsMeta => {
  const data = asRecord(response?.data);
  const receivable = asRecord(data.receivable);
  return {
    branches: parseTotals(receivable.branches),
    hqCouriers: parseTotals(receivable.hq_couriers),
    payable: parsePayable(data.payable),
  };
};
