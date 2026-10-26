import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

/**
 * KVITANSIYA YETKAZISH METRIKASI (2crjWf7v) — `GET /telegram/dm-delivery` (faqat superadmin; boshqa rol — 403).
 * Ma'lumot `notifications.delivery.telegram` dan: `total` (DM so'ralgan qabul qiluvchilar), `sent` (yetdi), `failed`,
 * `pending`, `skipped` (ataylab yuborilmadi: Telegram ulanmagan, botni bloklagan, guruh chati), `no_provider`.
 * Nisbatlar 0..1, maxraj 0 bo'lsa `null` («ma'lumot yo'q», 0% emas):
 *  - `delivery_ratio = sent / (sent + failed + pending)` — yuborilganlardan yetgani;
 *  - `reach_ratio = sent / total` — hamma qabul qiluvchidan yetgani («yozildi ≠ yetadi»).
 */
export type DmDeliveryCounts = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  noProvider: number;
  other: number;
  deliveryRatio: number | null;
  reachRatio: number | null;
};

export type DmDeliveryReport = {
  /** Haqiqiy chegara (ISO, UTC): `to` kirmaydi. */
  from: string | null;
  to: string | null;
  totals: DmDeliveryCounts;
  /** `{ no_telegram_id: 20, bot_blocked: 3, … }` — kalitlar ochiq ro'yxat. */
  skippedReasons: Record<string, number>;
};

export type DmDeliveryParams = {
  /** `YYYY-MM-DD` (Toshkent kuni); bo'sh — backend sukuti (oxirgi 30 kun). */
  from?: string;
  to?: string;
};

const count = (value: unknown): number => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const ratio = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toCounts = (raw: unknown): DmDeliveryCounts => {
  const row = asRecord(raw);
  return {
    total: count(row.total),
    sent: count(row.sent),
    failed: count(row.failed),
    pending: count(row.pending),
    skipped: count(row.skipped),
    noProvider: count(row.no_provider),
    other: count(row.other),
    deliveryRatio: ratio(row.delivery_ratio),
    reachRatio: ratio(row.reach_ratio),
  };
};

/** `{ statusCode, message, data: {...} }` → hisobot (o'ralmagan javob ham). */
export const toDmDeliveryReport = (payload: unknown): DmDeliveryReport => {
  const root = asRecord(payload);
  const data = asRecord("data" in root ? root.data : payload);
  const reasons: Record<string, number> = {};
  for (const [key, value] of Object.entries(asRecord(data.skipped_reasons))) {
    const n = count(value);
    if (n > 0) reasons[key] = n;
  }
  return {
    from: typeof data.from === "string" ? data.from : null,
    to: typeof data.to === "string" ? data.to : null,
    totals: toCounts(data.totals),
    skippedReasons: reasons,
  };
};

export const dmDeliveryKey = (params: DmDeliveryParams) =>
  ["telegram-dm-delivery", params.from ?? "", params.to ?? ""] as const;

export const fetchDmDelivery = async (params: DmDeliveryParams): Promise<DmDeliveryReport> => {
  const query: Record<string, string> = {};
  if (params.from && params.to) {
    query.from = params.from;
    query.to = params.to;
  }
  const response = await api.get(API_ENDPOINTS.TELEGRAM_REPORTS.DM_DELIVERY, { params: query });
  return toDmDeliveryReport(response.data);
};

/** `enabled` — faqat superadmin (boshqa rolga so'rov yuborilmaydi — 403). Xato kartaning o'zida (global xabarsiz). */
export const useDmDelivery = (params: DmDeliveryParams, enabled: boolean) =>
  useQuery({
    queryKey: dmDeliveryKey(params),
    queryFn: () => fetchDmDelivery(params),
    enabled,
    staleTime: 60_000,
    meta: { silentError: true },
  });
