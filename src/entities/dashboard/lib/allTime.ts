import { getAllTimeRange, getTodayRange, type ISODateRange } from "../../../shared/lib/dateRange";

/**
 * «BARCHASI» (tya24blo, backend uN1tjjGu). Hamma rolda — superadmin, market, menejer — `all=true` yuboriladi.
 * Ilgari market va menejer `start_day=1970-01-01` yuborardi. Backend oraliqni ko'pi bilan `max_span_days`
 * (366) kunga qisqartiradi va `clamped: true` + `effective_from` (`effective_to`) qaytaradi: «Barchasi» aslida
 * oxirgi 366 kun. Sarlavhadagi sana maydoni shu haqiqiy oraliqni ko'rsatadi (`DashboardHeader.effectiveRange`).
 */
export const isAllTimeRange = (fromDate: string, toDate: string) => {
  const all = getAllTimeRange();
  return fromDate === all.from && toDate === all.to;
};

/** `analytics/dashboard` sana parametrlari: «Barchasi» — `{ all: true }`, aks holda `start_day` / `end_day`. */
export const buildDashboardDateParams = (fromDate: string, toDate: string) => {
  if (isAllTimeRange(fromDate, toDate)) return { all: true };
  const hasRange = Boolean(fromDate && toDate);
  return { start_day: hasRange ? fromDate : "", end_day: hasRange ? toDate : "" };
};

export interface AppliedRange {
  /** Backend so'ralgan oraliqni qisqartirdi (`max_span_days` dan uzun). */
  clamped: boolean;
  from: string | null;
  to: string | null;
}

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const tashkentDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `"2025-10-21"` o'zicha; to'liq vaqt (`"2025-10-20T19:00:00.000Z"`) — Toshkentdagi kun (UTC kuni emas). */
const toIsoDay = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : tashkentDay.format(date);
};

const fromSource = (source: UnknownRecord | null): AppliedRange | null => {
  if (!source) return null;
  const clamped = source.clamped === true;
  const from = toIsoDay(source.effective_from ?? source.effectiveFrom ?? source.from);
  const to = toIsoDay(source.effective_to ?? source.effectiveTo ?? source.to);
  if (!clamped && !from && !to) return null;
  return { clamped, from, to };
};

/**
 * Xom `analytics/dashboard` javobidagi (`data`) qo'llangan oraliq. Qidiruv tartibi: yuqori daraja
 * (`clamped`, `effective_from`, `effective_to`), `applied_range`, keyin `orders.applied_range` va
 * `myStat.applied_range` (backend market/menejer javobida meta shu yerda edi). Hech biri yo'q — `null`.
 */
export const readAppliedRange = (data: unknown): AppliedRange | null => {
  const root = record(data);
  if (!root) return null;
  const candidates = [
    root,
    record(root.applied_range ?? root.appliedRange),
    record(record(root.orders)?.applied_range),
    record(record(root.myStat ?? root.my_stat)?.applied_range),
  ];
  for (const candidate of candidates) {
    const range = fromSource(candidate);
    if (range?.clamped) return range;
  }
  return null;
};

/**
 * Sana maydonida ko'rsatiladigan haqiqiy oraliq: faqat «Barchasi» tanlangan va backend qisqartirgan bo'lsa.
 * `effective_to` kelmasa — bugun (qisqartirish hozirgi kundan orqaga hisoblanadi).
 */
export const getEffectiveAllTimeRange = (
  fromDate: string,
  toDate: string,
  applied: AppliedRange | null | undefined,
): ISODateRange | null => {
  if (!isAllTimeRange(fromDate, toDate) || !applied?.clamped || !applied.from) return null;
  return { from: applied.from, to: applied.to ?? getTodayRange().to };
};
