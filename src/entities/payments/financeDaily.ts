import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { parseISODate, toISODate, type ISODateRange } from "../../shared/lib/dateRange";

/**
 * qzjTMWPb — KUNLIK MOLIYA AGREGATLARI (faqat o'qish).
 *
 *  - `GET /finance/history/daily` — kassa doirasining kunlik kirim/chiqimi va kun boshi/oxiri qoldig'i: «Pul oqimi»,
 *    «Kassa oqimi», «Balans dinamikasi», «kechaga nisbatan», sparkline, kassa tafsilotidagi «Davr boshida».
 *  - `GET /finance/financial-balance/daily` — Balans sahifasi: KPI snapshot'lari va P&L daftari.
 *
 * Normalizatorlar ataylab qat'iy: noma'lum yoki buzuq qiymat `null` bo'ladi, 0 EMAS — sahifa o'sha ko'rsatkichni
 * chizmaydi («—»), yolg'on nol chiqmaydi. So'rovlar `silentError`: 403 yoki xatoda global xabar yo'q, blokning o'zi
 * holatni ko'rsatadi. Kalit `cashbox` prefiksi ostida — to'lovdan keyin `refreshCashboxQueries` yangilaydi.
 */

/** `entities/payments` dagi `cashbox` kaliti bilan bir xil (import — test mock'lari modulni butunlay almashtiradi). */
const CASHBOX_QUERY_KEY = "cashbox";

/** Backend cheklovi: `GET …/daily` oralig'i ko'pi bilan 366 kun. */
export const FINANCE_DAILY_MAX_DAYS = 366;

export type BalanceStatus = "ok" | "pending" | "partial";

export type FinanceDailyParams = {
  from_date?: string;
  to_date?: string;
  cashbox_id?: string;
  user_id?: string;
  cashbox_type?: string;
  operation_type?: string;
  source_type?: string;
  source_types?: string;
  source_user_id?: string;
  created_by?: string;
};

export type DailyFlow = {
  date: string;
  income: number;
  expense: number;
  net: number;
  incomeCount: number;
  expenseCount: number;
  /** Kun boshi / oxiri qoldig'i. `null` — snapshot hali yo'q yoki kelajak kuni. */
  openingBalance: number | null;
  closingBalance: number | null;
};

export type DailyFlowTotals = Pick<DailyFlow, "income" | "expense" | "net" | "incomeCount" | "expenseCount">;

export type FinanceHistoryDaily = {
  from: string;
  to: string;
  /** Manba / tur / yaratgan filtri bor: oqimlar filtrlangan, qoldiqlar kassa doirasiga bog'liq (filtrga emas). */
  filtered: boolean;
  balanceStatus: BalanceStatus;
  openingBalance: number | null;
  closingBalance: number | null;
  totals: DailyFlowTotals;
  days: DailyFlow[];
};

export type BalanceSnapshot = {
  source: "live" | "backfill";
  mainBalance: number | null;
  /** `backfill` kunlarida `null` — tarixdan tiklab bo'lmaydi. */
  inTransit: number | null;
  marketsDebt: number | null;
  currentSituation: number | null;
};

export type LedgerDay = {
  openingBalance: number | null;
  closingBalance: number | null;
  income: number;
  expense: number;
  net: number;
  count: number;
};

export type FinancialBalanceDay = { date: string; snapshot: BalanceSnapshot | null; ledger: LedgerDay };

export type FinancialBalanceDaily = {
  from: string;
  to: string;
  ledger: Omit<LedgerDay, "openingBalance" | "closingBalance"> & {
    openingBalance: number | null;
    closingBalance: number | null;
    peak: { date: string; balance: number } | null;
  };
  days: FinancialBalanceDay[];
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const toBalanceStatus = (value: unknown): BalanceStatus =>
  value === "pending" || value === "partial" ? value : "ok";

const parseDailyFlow = (value: unknown): DailyFlow | null => {
  const row = asRecord(value);
  const date = text(row.date);
  const income = finite(row.income);
  const expense = finite(row.expense);
  if (!date || income === null || expense === null) return null;
  return {
    date,
    income,
    expense,
    net: finite(row.net) ?? income - expense,
    incomeCount: finite(row.income_count) ?? 0,
    expenseCount: finite(row.expense_count) ?? 0,
    openingBalance: finite(row.opening_balance),
    closingBalance: finite(row.closing_balance),
  };
};

/** Shakl buzuq bo'lsa — `null` (bir qator buzuq bo'lsa ham: yarim grafik yolg'on xulosa beradi). */
export const normalizeHistoryDaily = (response: unknown): FinanceHistoryDaily | null => {
  const data = asRecord(asRecord(response).data);
  if (!Array.isArray(data.days)) return null;
  const days = data.days.map(parseDailyFlow);
  if (days.some((day) => day === null)) return null;
  const rows = days as DailyFlow[];
  const totals = asRecord(data.totals);
  const income = finite(totals.income) ?? rows.reduce((sum, day) => sum + day.income, 0);
  const expense = finite(totals.expense) ?? rows.reduce((sum, day) => sum + day.expense, 0);
  return {
    from: text(data.from) || (rows[0]?.date ?? ""),
    to: text(data.to) || (rows.at(-1)?.date ?? ""),
    filtered: data.filtered === true,
    balanceStatus: toBalanceStatus(data.balance_status),
    openingBalance: finite(data.opening_balance),
    closingBalance: finite(data.closing_balance),
    totals: {
      income,
      expense,
      net: finite(totals.net) ?? income - expense,
      incomeCount: finite(totals.income_count) ?? rows.reduce((sum, day) => sum + day.incomeCount, 0),
      expenseCount: finite(totals.expense_count) ?? rows.reduce((sum, day) => sum + day.expenseCount, 0),
    },
    days: rows,
  };
};

const parseSnapshot = (value: unknown): BalanceSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as UnknownRecord;
  return {
    source: row.source === "backfill" ? "backfill" : "live",
    mainBalance: finite(row.main_balance),
    inTransit: finite(row.in_transit),
    marketsDebt: finite(row.markets_debt),
    currentSituation: finite(row.current_situation),
  };
};

const parseLedgerDay = (value: unknown): LedgerDay | null => {
  const row = asRecord(value);
  const income = finite(row.income);
  const expense = finite(row.expense);
  if (income === null || expense === null) return null;
  return {
    openingBalance: finite(row.opening_balance),
    closingBalance: finite(row.closing_balance),
    income,
    expense,
    net: finite(row.net) ?? income - expense,
    count: finite(row.count) ?? 0,
  };
};

export const normalizeFinancialBalanceDaily = (response: unknown): FinancialBalanceDaily | null => {
  const data = asRecord(asRecord(response).data);
  if (!Array.isArray(data.days)) return null;
  const days: FinancialBalanceDay[] = [];
  for (const value of data.days) {
    const row = asRecord(value);
    const ledger = parseLedgerDay(row.ledger);
    const date = text(row.date);
    if (!date || !ledger) return null;
    days.push({ date, snapshot: parseSnapshot(row.snapshot), ledger });
  }
  const ledger = asRecord(data.ledger);
  const peakRow = asRecord(ledger.peak);
  const peakBalance = finite(peakRow.balance);
  const peakDate = text(peakRow.date);
  return {
    from: text(data.from) || (days[0]?.date ?? ""),
    to: text(data.to) || (days.at(-1)?.date ?? ""),
    ledger: {
      openingBalance: finite(ledger.opening_balance),
      closingBalance: finite(ledger.closing_balance),
      income: finite(ledger.income) ?? 0,
      expense: finite(ledger.expense) ?? 0,
      net: finite(ledger.net) ?? 0,
      count: finite(ledger.count) ?? 0,
      peak: peakBalance !== null && peakDate ? { date: peakDate, balance: peakBalance } : null,
    },
    days,
  };
};

/* ─── Sof yordamchilar ──────────────────────────────────────────────────── */

/** `YYYY-MM-DD` ± kun (mahalliy kalendar). Noto'g'ri satr — o'zi. */
export const shiftDay = (day: string, delta: number) => {
  const date = parseISODate(day);
  if (!date) return day;
  date.setDate(date.getDate() + delta);
  return toISODate(date);
};

/** Bugun bilan tugaydigan `count` kunlik oraliq (backend sukuti — 14 kun). */
export const lastDaysRange = (count: number, now: Date = new Date()): ISODateRange => {
  const to = toISODate(now);
  return { from: shiftDay(to, -(count - 1)), to };
};

export const daysBetween = (from: string, to: string) => {
  const start = parseISODate(from);
  const end = parseISODate(to);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
};

/**
 * Filtr oralig'ini kunlik endpoint uchun: bo'sh — oxirgi `fallbackDays` kun; bir cheti bo'sh — ikkinchisidan
 * to'ldiriladi; 366 kundan uzun — oxirgi 366 kun (400 o'rniga; sarlavhada haqiqiy oraliq ko'rinadi).
 */
export const toDailyRange = (
  range: { from?: string; to?: string },
  fallbackDays = 14,
  now: Date = new Date(),
): ISODateRange => {
  const fallback = lastDaysRange(fallbackDays, now);
  if (!range.from && !range.to) return fallback;
  const to = range.to || fallback.to;
  const from = range.from || shiftDay(to, -(fallbackDays - 1));
  return daysBetween(from, to) > FINANCE_DAILY_MAX_DAYS ? { from: shiftDay(to, -(FINANCE_DAILY_MAX_DAYS - 1)), to } : { from, to };
};

/** Qoldig'i ma'lum kunlar (kelajak va snapshot'i yo'q kunlar tashlanadi). */
export const closingPoints = (days: readonly DailyFlow[]) =>
  days.flatMap((day) =>
    day.closingBalance === null
      ? []
      : [{ date: day.date, balance: day.closingBalance, income: day.income, expense: day.expense }],
  );

export type DayChange = { amount: number; percent: number | null };

const changeBetween = (current: number, previous: number): DayChange => ({
  amount: current - previous,
  percent: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
});

/** «Kechaga nisbatan» = bugungi − kechagi `closing_balance`. Biri noma'lum bo'lsa — `null` (delta chizilmaydi). */
export const dayOverDay = (days: readonly DailyFlow[], today: string = toISODate(new Date())): DayChange | null => {
  const current = days.find((day) => day.date === today)?.closingBalance ?? null;
  const previous = days.find((day) => day.date === shiftDay(today, -1))?.closingBalance ?? null;
  return current === null || previous === null ? null : changeBetween(current, previous);
};

export type BalanceTrend = {
  /** Sparkline: o'tgan kunlar snapshot'i + bugungi jonli qiymat (`null` nuqtalar tashlangan). */
  series: number[];
  change: DayChange | null;
};

/**
 * Balans KPI kartasi: `pick` snapshot'dan qiymatni oladi, `live` — bugungi jonli qiymat (`/cashbox/financial-balanse`).
 * Bugun uchun snapshot yo'q (`null`), kechagi snapshot `backfill` bo'lib maydon `null` bo'lsa — delta chizilmaydi.
 */
export const balanceTrend = (
  days: readonly FinancialBalanceDay[],
  pick: (snapshot: BalanceSnapshot) => number | null,
  live: number | null,
  today: string = toISODate(new Date()),
): BalanceTrend => {
  const past = days
    .filter((day) => day.date < today && day.snapshot)
    .map((day) => pick(day.snapshot as BalanceSnapshot))
    .filter((value): value is number => value !== null);
  const yesterday = days.find((day) => day.date === shiftDay(today, -1))?.snapshot ?? null;
  const previous = yesterday ? pick(yesterday) : null;
  return {
    series: live === null ? past : [...past, live],
    change: live === null || previous === null ? null : changeBetween(live, previous),
  };
};

/* ─── So'rovlar ─────────────────────────────────────────────────────────── */

const isForbidden = (error: unknown) => asRecord(asRecord(error).response).status === 403;

/** 403 da qayta urinilmaydi (ruxsat o'zgarmaydi), boshqa xato — bir marta. */
const retryOnce = (failures: number, error: unknown) => !isForbidden(error) && failures < 1;

/** Blok ruxsat yo'q rolda jim yashirinadi (xato kartasi chizilmaydi). */
export const isFinanceDailyForbidden = isForbidden;

export const useFinanceHistoryDaily = (params: FinanceDailyParams, enabled: boolean = true) =>
  useQuery({
    queryKey: [CASHBOX_QUERY_KEY, "history-daily", params],
    queryFn: () =>
      api.get(API_ENDPOINTS.FINANCE.HISTORY_DAILY, { params }).then((res) => res.data as unknown),
    select: normalizeHistoryDaily,
    enabled,
    retry: retryOnce,
    meta: { silentError: true },
  });

export const useFinancialBalanceDaily = (range: ISODateRange, enabled: boolean = true) => {
  const params = { from_date: range.from, to_date: range.to };
  return useQuery({
    queryKey: [CASHBOX_QUERY_KEY, "financial-balance-daily", params],
    queryFn: () =>
      api.get(API_ENDPOINTS.FINANCE.FINANCIAL_BALANCE_DAILY, { params }).then((res) => res.data as unknown),
    select: normalizeFinancialBalanceDaily,
    enabled,
    retry: retryOnce,
    meta: { silentError: true },
  });
};
