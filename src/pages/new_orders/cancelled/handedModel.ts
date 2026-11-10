import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  HANDOVER_BATCH_DEFAULT_LIMIT,
  HANDOVER_BATCH_PAGE_LIMITS,
  type HandoverBatch,
  type HandoverBatchesParams,
} from "../../../entities/orders/cancelledHandovers";
import { getThisMonthRange, type ISODateRange } from "../../../shared/lib/dateRange";
import { usePagination } from "../../../shared/lib/usePagination";

/**
 * «Bekor qilinganlar» ichki tablari («Kutilmoqda | Topshirilgan») va «Topshirilgan» filtrlari — holat URL'da:
 * `?tab=handed&q=…&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&limit=`. Sana berilmasa — joriy oy (1-sanadan bugungacha).
 */

export type CancelledTab = "pending" | "handed";

export const CANCELLED_TAB_PARAM = "tab";
export const HANDED_SEARCH_PARAM = "q";
export const HANDED_FROM_PARAM = "from";
export const HANDED_TO_PARAM = "to";

export const readCancelledTab = (params: URLSearchParams): CancelledTab =>
  params.get(CANCELLED_TAB_PARAM) === "handed" ? "handed" : "pending";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Haqiqiy kalendar kuni (`2026-02-30` — yo'q). */
export const isValidDay = (value: string | null | undefined): value is string => {
  const match = value ? DAY_RE.exec(value) : null;
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** URL'dagi sana oralig'i; yaroqsiz / bo'sh — `fallback` (joriy oy). Teskari oraliq — almashtiriladi. */
export const readHandedRange = (params: URLSearchParams, fallback: ISODateRange): ISODateRange => {
  const from = params.get(HANDED_FROM_PARAM);
  const to = params.get(HANDED_TO_PARAM);
  if (!isValidDay(from) || !isValidDay(to)) return fallback;
  return from <= to ? { from, to } : { from: to, to: from };
};

const TASHKENT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TASHKENT_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tashkent",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Toshkent kuni `YYYY-MM-DD` (qurilma vaqt mintaqasiga qaramay) — server `day` bilan solishtirish uchun. */
export const tashkentDayOf = (date: Date): string => TASHKENT_DAY.format(date);

/** `YYYY-MM-DD` ± kun (UTC hisobida — yozgi vaqt siljimaydi). */
export const shiftDay = (day: string, delta: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

/** `2026-11-10` → `10.11.2026`. */
export const formatDayDots = (day: string): string => {
  const match = DAY_RE.exec(day);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : day;
};

/** Topshirish vaqti, Toshkent soati: `16:42`. */
export const formatTashkentTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : TASHKENT_TIME.format(date);
};

/** Karta / sahifa nomi: market nomi, bo'lmasa «Market #id» (`fallback`). */
export const handoverMarketName = (batch: HandoverBatch, fallback: (marketId: string) => string): string =>
  batch.market?.name?.trim() || fallback(batch.market_id);

export type HandedDayGroup = { day: string; items: HandoverBatch[]; orders: number };

/** Kartalar kun bo'yicha (server tartibi saqlanadi — eng yangisi birinchi). */
export const groupHandoverBatchesByDay = (items: readonly HandoverBatch[]): HandedDayGroup[] => {
  const groups: HandedDayGroup[] = [];
  for (const item of items) {
    const day = item.day || tashkentDayOf(new Date(item.handed_at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
      last.orders += item.orders_count;
    } else {
      groups.push({ day, items: [item], orders: item.orders_count });
    }
  }
  return groups;
};

/** «Topshirilgan» filtrlari (URL) va so'rov parametrlari. `index` (tab soni) va ro'yxat bitta manbadan o'qiydi. */
export const useHandedFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "cancelledHandovers",
    defaultLimit: HANDOVER_BATCH_DEFAULT_LIMIT,
    allowedLimits: HANDOVER_BATCH_PAGE_LIMITS,
  });
  const fallbackFrom = searchParams.get(HANDED_FROM_PARAM);
  const fallbackTo = searchParams.get(HANDED_TO_PARAM);
  // Joriy oy har renderda qayta hisoblanmasin (kalit barqaror) — URL o'zgarganda yangilanadi.
  const range = useMemo(
    () => readHandedRange(new URLSearchParams({ from: fallbackFrom ?? "", to: fallbackTo ?? "" }), getThisMonthRange()),
    [fallbackFrom, fallbackTo],
  );
  const search = searchParams.get(HANDED_SEARCH_PARAM) ?? "";

  const params = useMemo<HandoverBatchesParams>(
    () => ({ search, start_day: range.from, end_day: range.to, page, limit }),
    [limit, page, range.from, range.to, search],
  );

  /** Filtr o'zgarsa — 1-sahifa. */
  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          next.delete("page");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const setSearch = useCallback(
    (value: string) => update({ [HANDED_SEARCH_PARAM]: value.trim() || null }),
    [update],
  );
  const setRange = useCallback(
    (next: ISODateRange) =>
      update({
        [HANDED_FROM_PARAM]: isValidDay(next.from) ? next.from : null,
        [HANDED_TO_PARAM]: isValidDay(next.to) ? next.to : null,
      }),
    [update],
  );

  return { params, search, range, page, limit, setPage, setLimit, setSearch, setRange };
};

export type HandedFilters = ReturnType<typeof useHandedFilters>;
