import type { PaymentRow } from "../patmentHistoryTable";

/**
 * «ASOSIY KASSA» HISOBLARI — sahifadagi davr kartalari («Bugun / Bu hafta / Bu oy»), «Pul qayerdan keldi,
 * qayerga ketdi» bloki va «Kassa balansi» grafigi (kun oxiridagi qoldiq) uchun sof funksiyalar.
 *
 * Davr hisobi eski sahifadagi bilan AYNAN bir xil (`mainCashbox.tsx` v1, `filteredIncome` / `weeklyStats` /
 * `monthlyStats`): sana — `payment_date` → `createdAt` → `created_at`, brauzerning mahalliy (Toshkent) kuni;
 * hafta dushanbadan, oy 1-kunidan; summa `|amount|`, yo'nalish `operation_type` (income | expense).
 */

export type PeriodKey = "today" | "week" | "month";

export const PERIOD_KEYS: readonly PeriodKey[] = ["today", "week", "month"];

export type FlowTotals = { income: number; expense: number };

export type PeriodStats = FlowTotals & {
  /** Davr boshi, `YYYY-MM-DD`. */
  from: string;
  /** Davr oxiri (bugun), `YYYY-MM-DD`. */
  to: string;
};

export const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Mahalliy kalendar kuni, `YYYY-MM-DD`. */
export const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** `YYYY-MM-DD` → mahalliy yarim tun (noto'g'ri satr — `null`). */
export const parseIsoDate = (value: string): Date | null => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

/** Operatsiya sanasi (davr kartalari va jadval): `payment_date` → `createdAt` → `created_at`. */
export const rowDateValue = (row: PaymentRow) => row.payment_date || row.createdAt || row.created_at || "";

/** Davr boshi: bugun · shu hafta dushanbasi · oyning 1-kuni (eski `buildRangeStart`). */
export const buildRangeStart = (type: PeriodKey, now: Date = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (type === "today") return toIsoDate(today);

  if (type === "week") {
    const weekStart = new Date(today);
    const weekday = weekStart.getDay();
    const diff = weekday === 0 ? 6 : weekday - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    return toIsoDate(weekStart);
  }

  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
};

/** Kirim / chiqim yig'indisi (`|amount|`, `operation_type` bo'yicha). */
export const summarizeHistory = (items: readonly PaymentRow[] = []): FlowTotals =>
  items.reduce(
    (accumulator, item) => {
      const amount = Math.abs(toNumber(item.amount));
      if (item.operation_type === "income") accumulator.income += amount;
      else if (item.operation_type === "expense") accumulator.expense += amount;
      return accumulator;
    },
    { income: 0, expense: 0 },
  );

const hasValidDate = (row: PaymentRow) => {
  const rawDate = rowDateValue(row);
  if (!rawDate) return false;
  return Number.isFinite(new Date(rawDate).getTime());
};

/** `fromDate` dan bugungacha (ikkala chet ham kiradi) bo'lgan qatorlar — eski `filterByRange`. */
export const filterRowsFrom = (rows: readonly PaymentRow[], fromDate: string, now: Date = new Date()) => {
  const todayEnd = toIsoDate(now);
  return rows.filter((row) => {
    if (!hasValidDate(row)) return false;
    const isoDate = toIsoDate(new Date(rowDateValue(row)));
    return isoDate >= fromDate && isoDate <= todayEnd;
  });
};

/** «Bugun / Bu hafta / Bu oy» — har biri kirim, chiqim va sana oralig'i bilan. */
export const computePeriodStats = (
  rows: readonly PaymentRow[],
  now: Date = new Date(),
): Record<PeriodKey, PeriodStats> => {
  const to = toIsoDate(now);
  const stats = (key: PeriodKey): PeriodStats => {
    const from = buildRangeStart(key, now);
    return { ...summarizeHistory(filterRowsFrom(rows, from, now)), from, to };
  };
  return { today: stats("today"), week: stats("week"), month: stats("month") };
};

export type SourceBucket = {
  sourceType: string;
  amount: number;
  /** Ulush, 0…100 (yo'nalish jamidan). */
  share: number;
};

/**
 * «Pul qayerdan keldi, qayerga ketdi»: berilgan yo'nalishdagi qatorlar `source_type` bo'yicha, kamayish
 * tartibida. Kassalar orasidagi o'tkazmalar (`courier_payment`, `market_payment`, `branch_to_main`) o'z nomi
 * bilan qoladi — «xarajat» guruhiga qo'shilmaydi.
 */
export const groupBySource = (rows: readonly PaymentRow[], operation: "income" | "expense"): SourceBucket[] => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.operation_type !== operation) continue;
    const key = String(row.source_type ?? "").trim().toLowerCase() || "unknown";
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(toNumber(row.amount)));
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([sourceType, amount]) => ({ sourceType, amount, share: total > 0 ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
};

export type DailyBalancePoint = {
  /** `YYYY-MM-DD` (mahalliy kun). */
  date: string;
  /** Kun oxiridagi qoldiq (shu kunning oxirgi yozuvidagi `balance_after`; yozuv bo'lmasa — oldingi kunniki). */
  balance: number;
  income: number;
  expense: number;
};

type HistoryEntry = { time: number; order: number; balance: number | null; operation: string; amount: number };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** Kassa tarixi qatori: yaratilgan vaqti (qoldiq `balance_after` shu tartibda yoziladi). */
const toHistoryEntry = (value: unknown, index: number): HistoryEntry | null => {
  const row = asRecord(value);
  const raw = row.createdAt ?? row.created_at ?? row.payment_date;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return null;
  const balance = row.balance_after === null || row.balance_after === undefined ? null : toNumber(row.balance_after, NaN);
  const id = Number(row.id);
  return {
    time,
    // Bir lahzadagi yozuvlar: kattaroq ID keyin yozilgan; ID bo'lmasa — javob tartibi (yangisi tepada).
    order: Number.isFinite(id) ? id : -index,
    balance: balance !== null && Number.isFinite(balance) ? balance : null,
    operation: String(row.operation_type ?? ""),
    amount: Math.abs(toNumber(row.amount)),
  };
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * «Kassa balansi» grafigi — kun oxiridagi qoldiq (`GET finance/cashbox/main` → `cashboxHistory`).
 *
 * Davr: sana filtri (`from` / `to`, ikkalasi ham) bo'lsa — shu oraliq (oxiri bugundan oshmaydi), bo'lmasa — oxirgi
 * `windowDays` kun. Har kun: o'sha kunning oxirgi yozuvidagi `balance_after`; yozuvsiz kun — oldingi kun qoldig'i
 * (davr boshidan oldingi oxirgi yozuv ham hisobga olinadi). Hali qoldig'i ma'lum bo'lmagan kunlar chizilmaydi.
 */
export const buildDailyBalanceSeries = (
  history: readonly unknown[],
  options: { from?: string; to?: string; now?: Date; windowDays?: number } = {},
): DailyBalancePoint[] => {
  const now = options.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const filterEnd = options.from && options.to ? parseIsoDate(options.to) : null;
  const filterStart = options.from && options.to ? parseIsoDate(options.from) : null;
  const end = filterEnd && filterEnd < today ? filterEnd : today;
  const start = filterStart ?? addDays(end, -((options.windowDays ?? 30) - 1));
  if (start > end) return [];

  const entries = history
    .map(toHistoryEntry)
    .filter((entry): entry is HistoryEntry => entry !== null)
    .sort((a, b) => a.time - b.time || a.order - b.order);

  const startKey = toIsoDate(start);
  const byDay = new Map<string, HistoryEntry[]>();
  let carry: number | null = null;
  for (const entry of entries) {
    const key = toIsoDate(new Date(entry.time));
    if (key < startKey) {
      if (entry.balance !== null) carry = entry.balance;
      continue;
    }
    const list = byDay.get(key);
    if (list) list.push(entry);
    else byDay.set(key, [entry]);
  }

  const points: DailyBalancePoint[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const key = toIsoDate(day);
    const dayEntries = byDay.get(key) ?? [];
    let income = 0;
    let expense = 0;
    for (const entry of dayEntries) {
      if (entry.operation === "income") income += entry.amount;
      else if (entry.operation === "expense") expense += entry.amount;
      if (entry.balance !== null) carry = entry.balance;
    }
    if (carry === null) continue;
    points.push({ date: key, balance: carry, income, expense });
  }
  return points;
};
