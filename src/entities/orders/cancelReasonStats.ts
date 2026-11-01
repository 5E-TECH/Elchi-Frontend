import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../shared/api";
import { api } from "../../shared/api/api";

/**
 * BEKOR QILISH SABABLARI HISOBOTI (GNWDKvmZ) — `GET /orders/cancel-reasons/stats?startDate&endDate` (Toshkent kuni,
 * `endDate` kuni kiradi) `[&market_id|branch_id — faqat superadmin/admin]`. Javob:
 * `{ total, by_reason: [{ reason, label, count }], applied_range }`. `group_by` qatorlari ishlatilmaydi.
 */
export interface CancelReasonStatsParams {
  startDate?: string;
  endDate?: string;
  market_id?: string;
  branch_id?: string;
}

export interface CancelReasonStat {
  reason: string;
  /** Backend yorlig'i — tarjimasi yo'q sabab uchun zaxira. */
  label: string | null;
  count: number;
  /** Ulush, % (`count / total`). */
  share: number;
}

export interface CancelReasonStats {
  total: number;
  /** Ko'pi birinchi; soni 0 sabab chiqarilmaydi. */
  reasons: CancelReasonStat[];
  /** Backend haqiqatda hisoblagan oraliq; kelmasa — `null` (so'ralgan oraliq ko'rsatiladi). */
  appliedRange: { from: string; to: string } | null;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const count = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const readRange = (value: unknown): CancelReasonStats["appliedRange"] => {
  const range = asRecord(value);
  const from = text(range?.startDate ?? range?.start_date ?? range?.from);
  const to = text(range?.endDate ?? range?.end_date ?? range?.to);
  return from && to ? { from, to } : null;
};

export const normalizeCancelReasonStats = (payload: unknown): CancelReasonStats => {
  const root = asRecord(payload) ?? {};
  const data = asRecord(root.data) ?? root;
  const rows = (Array.isArray(data.by_reason) ? data.by_reason : [])
    .map(asRecord)
    .filter((row): row is UnknownRecord => row !== null)
    .map((row) => ({ reason: text(row.reason) ?? "UNKNOWN", label: text(row.label), count: count(row.count) }))
    .filter((row) => row.count > 0);
  const total = count(data.total) || rows.reduce((sum, row) => sum + row.count, 0);
  return {
    total,
    reasons: rows
      .map((row) => ({ ...row, share: total > 0 ? (row.count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count),
    appliedRange: readRange(data.applied_range),
  };
};

export const useCancelReasonStats = (params: CancelReasonStatsParams) =>
  useQuery({
    queryKey: ["orders", "cancel-reasons", "stats", params],
    queryFn: () =>
      api.get(API_ENDPOINTS.ORDERS.CANCEL_REASON_STATS, { params }).then((res) => normalizeCancelReasonStats(res.data)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
