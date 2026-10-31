import { describe, expect, it } from "vitest";
import {
  balanceTrend,
  closingPoints,
  dayOverDay,
  daysBetween,
  lastDaysRange,
  normalizeFinancialBalanceDaily,
  normalizeHistoryDaily,
  shiftDay,
  toDailyRange,
  type BalanceSnapshot,
} from "./financeDaily";

const day = (date: string, closing: number | null, income = 0, expense = 0) => ({
  date,
  income,
  expense,
  net: income - expense,
  income_count: income ? 1 : 0,
  expense_count: expense ? 1 : 0,
  opening_balance: null,
  closing_balance: closing,
});

describe("normalizeHistoryDaily", () => {
  it("davr jami va qoldiqlarni serverdan oladi", () => {
    const parsed = normalizeHistoryDaily({
      data: {
        from: "2026-10-01",
        to: "2026-10-02",
        filtered: true,
        balance_status: "partial",
        opening_balance: 100,
        closing_balance: 250,
        totals: { income: 200, expense: 50, net: 150, income_count: 2, expense_count: 1 },
        days: [day("2026-10-01", 200, 150, 50), day("2026-10-02", 250, 50, 0)],
      },
    });
    expect(parsed).toMatchObject({
      from: "2026-10-01",
      filtered: true,
      balanceStatus: "partial",
      openingBalance: 100,
      closingBalance: 250,
      totals: { income: 200, expense: 50, net: 150, incomeCount: 2, expenseCount: 1 },
    });
    expect(parsed?.days).toHaveLength(2);
  });

  it("noma'lum qoldiq 0 bo'lib ketmaydi; `pending` saqlanadi", () => {
    const parsed = normalizeHistoryDaily({
      data: { balance_status: "pending", opening_balance: null, closing_balance: null, days: [day("2026-10-01", null, 10, 0)] },
    });
    expect(parsed?.balanceStatus).toBe("pending");
    expect(parsed?.openingBalance).toBeNull();
    expect(parsed?.closingBalance).toBeNull();
    expect(parsed?.days[0].closingBalance).toBeNull();
    // `totals` yo'q — qatorlardan.
    expect(parsed?.totals.income).toBe(10);
  });

  it("buzuq javob (ro'yxat, qator) — `null`, yolg'on nol emas", () => {
    expect(normalizeHistoryDaily(undefined)).toBeNull();
    expect(normalizeHistoryDaily({ data: { items: [] } })).toBeNull();
    expect(normalizeHistoryDaily({ data: { days: [{ date: "2026-10-01", income: "x", expense: 0 }] } })).toBeNull();
  });
});

describe("normalizeFinancialBalanceDaily", () => {
  it("snapshot, daftar va eng yuqori kun", () => {
    const parsed = normalizeFinancialBalanceDaily({
      data: {
        from: "2026-10-01",
        to: "2026-10-02",
        ledger: { opening_balance: 10, closing_balance: 30, income: 25, expense: 5, net: 20, count: 3, peak: { date: "2026-10-02", balance: 30 } },
        days: [
          {
            date: "2026-10-01",
            snapshot: { source: "backfill", main_balance: 7, in_transit: null, markets_debt: -3, current_situation: null },
            ledger: { opening_balance: 10, closing_balance: 20, income: 15, expense: 5, net: 10, count: 2 },
          },
          {
            date: "2026-10-02",
            snapshot: null,
            ledger: { opening_balance: 20, closing_balance: 30, income: 10, expense: 0, net: 10, count: 1 },
          },
        ],
      },
    });
    expect(parsed?.ledger.peak).toEqual({ date: "2026-10-02", balance: 30 });
    expect(parsed?.days[0].snapshot).toEqual({
      source: "backfill",
      mainBalance: 7,
      inTransit: null,
      marketsDebt: -3,
      currentSituation: null,
    });
    expect(parsed?.days[1].snapshot).toBeNull();
  });

  it("buzuq javob — `null`", () => {
    expect(normalizeFinancialBalanceDaily({ data: [] })).toBeNull();
    expect(normalizeFinancialBalanceDaily({ data: { days: [{ date: "2026-10-01" }] } })).toBeNull();
  });
});

describe("sana yordamchilari", () => {
  const now = new Date(2026, 9, 31, 12);

  it("shiftDay, daysBetween, lastDaysRange", () => {
    expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(8);
    expect(lastDaysRange(14, now)).toEqual({ from: "2026-10-18", to: "2026-10-31" });
  });

  it("toDailyRange: bo'sh — sukut, bir cheti — to'ldiriladi, uzun oraliq — 366 kunga qisiladi", () => {
    expect(toDailyRange({}, 14, now)).toEqual({ from: "2026-10-18", to: "2026-10-31" });
    expect(toDailyRange({ from: "2026-10-01" }, 14, now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(toDailyRange({ to: "2026-10-20" }, 14, now)).toEqual({ from: "2026-10-07", to: "2026-10-20" });
    const long = toDailyRange({ from: "2024-01-01", to: "2026-10-31" }, 14, now);
    expect(long.to).toBe("2026-10-31");
    expect(daysBetween(long.from, long.to)).toBe(366);
  });
});

describe("delta va chiziq", () => {
  const today = "2026-10-08";
  const flow = (date: string, closingBalance: number | null) => ({
    date,
    income: 0,
    expense: 0,
    net: 0,
    incomeCount: 0,
    expenseCount: 0,
    openingBalance: null,
    closingBalance,
  });

  it("dayOverDay: bugungi − kechagi; biri noma'lum — `null`", () => {
    expect(dayOverDay([flow("2026-10-07", 100), flow(today, 150)], today)).toEqual({ amount: 50, percent: 50 });
    expect(dayOverDay([flow("2026-10-07", 0), flow(today, 150)], today)).toEqual({ amount: 150, percent: null });
    expect(dayOverDay([flow("2026-10-07", null), flow(today, 150)], today)).toBeNull();
    expect(dayOverDay([flow(today, 150)], today)).toBeNull();
  });

  it("closingPoints: qoldig'i yo'q kunlar tashlanadi", () => {
    expect(closingPoints([flow("2026-10-07", null), flow(today, 150)]).map((point) => point.date)).toEqual([today]);
  });

  const snapshot = (mainBalance: number | null, inTransit: number | null): BalanceSnapshot => ({
    source: "live",
    mainBalance,
    inTransit,
    marketsDebt: null,
    currentSituation: null,
  });
  const ledger = { openingBalance: 0, closingBalance: 0, income: 0, expense: 0, net: 0, count: 0 };
  const days = [
    { date: "2026-10-06", snapshot: snapshot(80, null), ledger },
    { date: "2026-10-07", snapshot: snapshot(100, null), ledger },
    { date: today, snapshot: null, ledger },
  ];

  it("balanceTrend: o'tgan kunlar + jonli qiymat; kechagi `null` (backfill) — delta yo'q, nuqta tashlanadi", () => {
    expect(balanceTrend(days, (row) => row.mainBalance, 120, today)).toEqual({
      series: [80, 100, 120],
      change: { amount: 20, percent: 20 },
    });
    expect(balanceTrend(days, (row) => row.inTransit, 120, today)).toEqual({ series: [120], change: null });
  });
});
