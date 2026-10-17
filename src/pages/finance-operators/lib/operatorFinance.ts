/**
 * Operator hisob-kitobi — javob shakllari (backend `origin/main`, finance-service):
 *
 *  GET  finance/operators/:id/balance   → `{ statusCode, message, data: { operator_id, earned, paid, balance } }`
 *  GET  finance/operators/:id/earnings  → `{ …, data: { rows, total, limit, offset } }` (`createdAt DESC`, limit ≤ 200)
 *  GET  finance/operators/:id/payments  → `{ …, data: { rows, total, limit, offset } }`
 *  POST finance/operator-payments       → body `{ operator_id, amount, note? }` (DTO `forbidNonWhitelisted`:
 *                                          boshqa maydon — 400), sarlavha `Idempotency-Key` (ixtiyoriy).
 *
 * Konvert (`data`) va eski/yalang'och shakl ikkalasi ham o'qiladi.
 */

export type OperatorBalance = { earned: number; paid: number; balance: number };

export type OperatorEarningRow = { key: string; orderId: string; amount: number; createdAt: string | null };

export type OperatorPayoutRow = { key: string; amount: number; note: string; createdAt: string | null };

export type OperatorList<T> = { rows: T[]; total: number };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** `{ statusCode, message, data }` konvertini ochadi; konvert bo'lmasa — o'zini. */
const unwrap = (payload: unknown): unknown => {
  const record = asRecord(payload);
  if ("data" in record && ("statusCode" in record || "message" in record)) return record.data;
  return payload;
};

const toNumber = (value: unknown): number => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toText = (value: unknown): string => (value == null ? "" : String(value).trim());

const toDate = (row: Record<string, unknown>): string | null => {
  const value = row.createdAt ?? row.created_at;
  return value == null || value === "" ? null : String(value);
};

export const readOperatorBalance = (payload: unknown): OperatorBalance | null => {
  const data = asRecord(unwrap(payload));
  if (!("earned" in data) && !("paid" in data) && !("balance" in data)) return null;
  const earned = toNumber(data.earned);
  const paid = toNumber(data.paid);
  return { earned, paid, balance: "balance" in data ? toNumber(data.balance) : earned - paid };
};

const readList = (payload: unknown): { rows: Record<string, unknown>[]; total: number } => {
  const data = unwrap(payload);
  if (Array.isArray(data)) return { rows: data.map(asRecord), total: data.length };
  const record = asRecord(data);
  const rows = Array.isArray(record.rows)
    ? record.rows
    : Array.isArray(record.items)
      ? record.items
      : Array.isArray(record.data)
        ? record.data
        : [];
  return { rows: rows.map(asRecord), total: "total" in record ? toNumber(record.total) : rows.length };
};

export const readOperatorEarnings = (payload: unknown): OperatorList<OperatorEarningRow> => {
  const { rows, total } = readList(payload);
  return {
    total,
    rows: rows.map((row, index) => ({
      key: toText(row.id) || `earning-${index}`,
      orderId: toText(row.order_id),
      amount: toNumber(row.amount),
      createdAt: toDate(row),
    })),
  };
};

export const readOperatorPayouts = (payload: unknown): OperatorList<OperatorPayoutRow> => {
  const { rows, total } = readList(payload);
  return {
    total,
    rows: rows.map((row, index) => ({
      key: toText(row.id) || `payout-${index}`,
      amount: toNumber(row.amount),
      // Backend maydoni `note`; eski yozuvlarda `comment` bo'lishi mumkin.
      note: toText(row.note ?? row.comment),
      createdAt: toDate(row),
    })),
  };
};

/** Operator ID — bigint satri (DTO `^\d+$`). */
export const isOperatorId = (value: string) => /^\d+$/.test(value);

/** `POST finance/operator-payments` tanasi: izoh bo'sh bo'lsa yuborilmaydi. */
export const buildOperatorPaymentPayload = (operatorId: string, amount: number, note: string) => {
  const trimmed = note.trim();
  return { operator_id: operatorId, amount, ...(trimmed ? { note: trimmed } : {}) };
};

/** Har mantiqiy to'lov uchun bitta kalit (qayta urinishda — o'sha kalit). */
export const newPaymentKey = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
