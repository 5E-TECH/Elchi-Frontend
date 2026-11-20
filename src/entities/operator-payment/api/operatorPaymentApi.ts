import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type {
  MissingEarnings,
  MyOperatorBalance,
  MyOperatorPaymentList,
  OperatorAccountPageParams,
  OperatorBalance,
  OperatorBalances,
  OperatorEarning,
  OperatorEarningList,
  OperatorPayment,
  OperatorPaymentList,
  OperatorPaymentListParams,
  OperatorPaymentResult,
  RecordOperatorPaymentRequest,
} from "../model/types";

/**
 * F2qp6FtE — operatorga to'lov yozuvlari (backend `OperatorPaymentGatewayController`, faqat MARKET; operator o'zi —
 * `finance/operators/me/*`; superadmin/admin ko'radi — `finance/operators/:operator_id/*`, B1te60bD). Javoblar
 * `{ statusCode, message, data }`; konvertsiz shakl ham o'qiladi.
 */

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

/** `{ statusCode, message, data }` → `data`; konvert bo'lmasa — o'zi. */
const unwrap = (value: unknown): unknown => {
  const record = asRecord(value);
  if (record && "data" in record && ("statusCode" in record || "message" in record)) return record.data;
  return value;
};

const toNumber = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";

const toNullableText = (value: unknown): string | null => toText(value) || null;

/** `YYYY-MM-DD` (to'liq ISO kelsa — sana qismi). */
const toDay = (value: unknown): string | null => {
  const text = toText(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : null;
};

/** Buyurtmalar soni: butun manfiy bo'lmagan son yoki `null` (maydon yo'q / noma'lum). */
const toNullableCount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

export const normalizeOperatorBalance = (value: unknown): OperatorBalance => {
  const item = asRecord(value) ?? {};
  const earned = toNumber(item.earned);
  const paid = toNumber(item.paid);
  return {
    operatorId: toText(item.operator_id),
    operatorName: toText(item.operator_name),
    status: item.status === "deleted" ? "deleted" : item.status === "inactive" ? "inactive" : "active",
    ordersTotal: toNullableCount(item.orders_total),
    ordersSold: toNullableCount(item.orders_sold),
    ordersPending: toNullableCount(item.orders_pending),
    earned,
    paid,
    balance: "balance" in item ? toNumber(item.balance) : earned - paid,
    paymentsCount: toNumber(item.payments_count),
    lastPaidAt: toDay(item.last_paid_at),
  };
};

export const normalizeOperatorBalances = (value: unknown): OperatorBalances => {
  const data = asRecord(unwrap(value)) ?? {};
  const items = (Array.isArray(data.items) ? data.items : []).map(normalizeOperatorBalance).filter((item) => item.operatorId);
  const totals = asRecord(data.totals);
  const sum = (key: "earned" | "paid" | "balance") => items.reduce((total, item) => total + item[key], 0);
  return {
    items,
    totals: totals
      ? { earned: toNumber(totals.earned), paid: toNumber(totals.paid), balance: toNumber(totals.balance) }
      : { earned: sum("earned"), paid: sum("paid"), balance: sum("balance") },
  };
};

/** Market ko'rinishi (`OperatorPaymentViewDto`) va operatorning `/me/payments` qatori (eski entity shakli) — ikkalasi. */
export const normalizeOperatorPayment = (value: unknown): OperatorPayment => {
  const item = asRecord(value) ?? {};
  const createdAt = toNullableText(item.created_at ?? item.createdAt);
  const cancelledAt = toNullableText(item.cancelled_at);
  const status = item.status === "cancelled" || cancelledAt ? "cancelled" : "active";
  return {
    id: toText(item.id),
    operatorId: toText(item.operator_id),
    operatorName: toNullableText(item.operator_name),
    amount: toNumber(item.amount),
    paidAt: toDay(item.paid_at) ?? toDay(createdAt),
    // Backend maydoni `note`; eski yozuvlarda `comment` bo'lishi mumkin.
    note: toText(item.note ?? item.comment),
    source: item.source === "market" ? "market" : "elchi",
    affectsCashbox: item.affects_cashbox === true,
    createdAt,
    status,
    cancelledAt,
    cancelReason: toText(item.cancel_reason),
    canCancel: item.can_cancel === true && status === "active",
  };
};

export const normalizeOperatorPaymentList = (value: unknown, params: OperatorPaymentListParams): OperatorPaymentList => {
  const data = asRecord(unwrap(value)) ?? {};
  const items = Array.isArray(data.items) ? data.items : [];
  const pagination = asRecord(data.pagination) ?? asRecord(data.meta) ?? {};
  return {
    items: items.map(normalizeOperatorPayment).filter((item) => item.id),
    total: "total" in pagination ? toNumber(pagination.total) : items.length,
    page: toNumber(pagination.page) || params.page,
    limit: toNumber(pagination.limit) || params.limit,
  };
};

export const normalizeOperatorPaymentResult = (value: unknown): OperatorPaymentResult => {
  const data = asRecord(unwrap(value)) ?? {};
  return { payment: normalizeOperatorPayment(data), idempotent: data.idempotent === true };
};

export const normalizeMyOperatorBalance = (value: unknown): MyOperatorBalance | null => {
  const data = asRecord(unwrap(value));
  if (!data || !("earned" in data || "paid" in data || "balance" in data)) return null;
  const earned = toNumber(data.earned);
  const paid = toNumber(data.paid);
  return { earned, paid, balance: "balance" in data ? toNumber(data.balance) : earned - paid };
};

/** `{ rows, total, limit, offset }` (yoki `items`). */
export const normalizeMyOperatorPayments = (value: unknown): MyOperatorPaymentList => {
  const data = unwrap(value);
  if (Array.isArray(data)) return { items: data.map(normalizeOperatorPayment), total: data.length };
  const record = asRecord(data) ?? {};
  const rows = Array.isArray(record.rows) ? record.rows : Array.isArray(record.items) ? record.items : [];
  return { items: rows.map(normalizeOperatorPayment), total: "total" in record ? toNumber(record.total) : rows.length };
};

/** `GET finance/operators/me/earnings` dan faqat jami son (sotilgan buyurtmalar soni — «N ta sotilgan buyurtmadan»). */
export const normalizeEarningsTotal = (value: unknown): number | null => {
  const record = asRecord(unwrap(value));
  if (!record || !("total" in record)) return null;
  return toNumber(record.total);
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

/** `OperatorEarning` qatori (`/operators/:id/earnings` va `/me/earnings` — AYNI shakl). */
export const normalizeOperatorEarning = (value: unknown): OperatorEarning => {
  const item = asRecord(value) ?? {};
  const type = item.commission_type;
  return {
    id: toText(item.id),
    orderId: toText(item.order_id),
    amount: toNumber(item.amount),
    commissionType: type === "percent" || type === "fixed" ? type : null,
    commissionValue: toNullableNumber(item.commission_value),
    orderTotal: toNullableNumber(item.order_total_price),
    createdAt: toNullableText(item.createdAt ?? item.created_at),
  };
};

/** `{ rows, total, limit, offset }` (yoki `items`; market yo'li — `{ items, pagination: { total } }`). */
export const normalizeOperatorEarnings = (value: unknown): OperatorEarningList => {
  const data = unwrap(value);
  const record = asRecord(data) ?? {};
  const pagination = asRecord(record.pagination);
  const rows = Array.isArray(data) ? data : Array.isArray(record.rows) ? record.rows : Array.isArray(record.items) ? record.items : [];
  return {
    items: rows.map(normalizeOperatorEarning).filter((item) => item.id),
    total:
      "total" in record
        ? toNumber(record.total)
        : pagination && "total" in pagination
          ? toNumber(pagination.total)
          : rows.length,
  };
};

// ───────────────────────────── so'rovlar ─────────────────────────────

export const getOperatorBalances = async (): Promise<OperatorBalances> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATOR_PAYMENT_BALANCES);
  return normalizeOperatorBalances(response.data);
};

export const getOperatorPayments = async (params: OperatorPaymentListParams): Promise<OperatorPaymentList> => {
  const query: Record<string, string | number> = { page: params.page, limit: params.limit };
  if (params.operatorId) query.operator_id = params.operatorId;
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATOR_PAYMENTS, { params: query });
  return normalizeOperatorPaymentList(response.data, params);
};

/** Yozish: `Idempotency-Key` — bitta mantiqiy to'lov uchun bitta kalit (qayta urinishda o'sha kalit). */
export const recordOperatorPayment = async ({
  body,
  idempotencyKey,
}: {
  body: RecordOperatorPaymentRequest;
  idempotencyKey: string;
}): Promise<OperatorPaymentResult> => {
  const response = await api.post(API_ENDPOINTS.FINANCE.OPERATOR_PAYMENTS, body, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return normalizeOperatorPaymentResult(response.data);
};

export const cancelOperatorPayment = async ({ id, reason }: { id: string; reason: string }): Promise<OperatorPaymentResult> => {
  const response = await api.post(API_ENDPOINTS.FINANCE.OPERATOR_PAYMENT_CANCEL(id), { reason });
  return normalizeOperatorPaymentResult(response.data);
};

export const getMyOperatorBalance = async (): Promise<MyOperatorBalance | null> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATORS_ME_BALANCE);
  return normalizeMyOperatorBalance(response.data);
};

export const getMyOperatorPayments = async (params: { limit: number; offset: number }): Promise<MyOperatorPaymentList> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATORS_ME_PAYMENTS, { params });
  return normalizeMyOperatorPayments(response.data);
};

export const getMyOperatorEarningsTotal = async (): Promise<number | null> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATORS_ME_EARNINGS, { params: { limit: 1, offset: 0 } });
  return normalizeEarningsTotal(response.data);
};

// B1te60bD — superadmin/admin operator hisobini KO'RADI (faqat o'qish; `operator_id` — operator foydalanuvchi id'si).

export const getOperatorAccountBalance = async (operatorId: string): Promise<MyOperatorBalance | null> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATOR_BALANCE(operatorId));
  return normalizeMyOperatorBalance(response.data);
};

export const getOperatorAccountPayments = async (
  operatorId: string,
  params: OperatorAccountPageParams,
): Promise<MyOperatorPaymentList> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATOR_PAYOUTS(operatorId), { params });
  return normalizeMyOperatorPayments(response.data);
};

export const getOperatorAccountEarnings = async (
  operatorId: string,
  params: OperatorAccountPageParams,
): Promise<OperatorEarningList> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATOR_EARNINGS(operatorId), { params });
  return normalizeOperatorEarnings(response.data);
};

/**
 * 2026-11-20 — market: o'z operatori «Ishlab topdi» qatorlari (`GET finance/operator-payments/earnings`, o'chirilgan
 * operatorniki ham; begona — 404).
 */
export const getMarketOperatorEarnings = async (
  operatorId: string,
  params: { page: number; limit: number },
): Promise<OperatorEarningList> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATOR_PAYMENT_EARNINGS, {
    params: { operator_id: operatorId, page: params.page, limit: params.limit },
  });
  return normalizeOperatorEarnings(response.data);
};

export const normalizeMissingEarnings = (value: unknown): MissingEarnings => {
  const data = asRecord(unwrap(value)) ?? {};
  const type = data.commission_type;
  return {
    soldOrders: toNumber(data.sold_orders),
    alreadyRecorded: toNumber(data.already_recorded),
    missing: toNumber(data.missing),
    toRecord: toNumber(data.to_record),
    amount: toNumber(data.amount),
    commissionType: type === "percent" || type === "fixed" ? type : null,
    commissionValue: toNumber(data.commission_value),
    truncated: data.truncated === true,
    created: toNumber(data.created),
    createdAmount: toNumber(data.created_amount),
  };
};

/** 2026-11-20 — oldindan ko'rish (hech narsa yozilmaydi). */
export const getMissingEarnings = async (operatorId: string): Promise<MissingEarnings> => {
  const response = await api.get(API_ENDPOINTS.FINANCE.OPERATOR_MISSING_EARNINGS, {
    params: { operator_id: operatorId },
  });
  return normalizeMissingEarnings(response.data);
};

/** 2026-11-20 — joriy stavka bilan yozish (takror bosish ikkinchi qator ochmaydi). */
export const recordMissingEarnings = async (operatorId: string): Promise<MissingEarnings> => {
  const response = await api.post(API_ENDPOINTS.FINANCE.OPERATOR_MISSING_EARNINGS, { operator_id: operatorId });
  return normalizeMissingEarnings(response.data);
};

/** Har mantiqiy to'lov uchun yangi kalit. */
export const newOperatorPaymentKey = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
