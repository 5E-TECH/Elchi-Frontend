import type { PaymentRow } from "../patmentHistoryTable";
import {
  buildDailyBalanceSeries,
  buildRangeStart,
  computePeriodStats,
  filterRowsFrom,
  groupBySource,
} from "./mainCashboxStats";

/** Mahalliy vaqt (testlar mintaqaga bog'liq bo'lmasin). */
const local = (y: number, m: number, d: number, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

const row = (overrides: Partial<PaymentRow>): PaymentRow => ({
  id: String(Math.random()),
  amount: 0,
  operation_type: "income",
  ...overrides,
});

// Payshanba, 08.10.2026 — hafta dushanbasi 05.10, oy boshi 01.10.
const NOW = new Date(2026, 9, 8, 15, 0);

describe("mainCashboxStats — periods (same rules as the v1 page)", () => {
  it("period starts: today, Monday of this week, the 1st of the month", () => {
    expect(buildRangeStart("today", NOW)).toBe("2026-10-08");
    expect(buildRangeStart("week", NOW)).toBe("2026-10-05");
    expect(buildRangeStart("month", NOW)).toBe("2026-10-01");
    // Yakshanba — haftaning oxirgi kuni (dushanbadan boshlanadi).
    expect(buildRangeStart("week", new Date(2026, 9, 11, 9))).toBe("2026-10-05");
  });

  it("sums |amount| by operation_type, uses payment_date → createdAt, skips rows without a valid date", () => {
    const rows = [
      row({ amount: 6_970_000, operation_type: "income", payment_date: local(2026, 10, 8, 9) }),
      row({ amount: -2_400_000, operation_type: "expense", createdAt: local(2026, 10, 8, 13) }),
      row({ amount: 1_000_000, operation_type: "income", payment_date: local(2026, 10, 6) }),
      row({ amount: 500_000, operation_type: "expense", payment_date: local(2026, 10, 2) }),
      row({ amount: 9_999, operation_type: "income", payment_date: local(2026, 9, 30) }),
      row({ amount: 777, operation_type: "income" }),
      row({ amount: 888, operation_type: "income", payment_date: "not a date" }),
      // Kelajakdagi sana hisobga kirmaydi (bugungacha).
      row({ amount: 5, operation_type: "income", payment_date: local(2026, 10, 9) }),
    ];

    const stats = computePeriodStats(rows, NOW);
    expect(stats.today).toEqual({ income: 6_970_000, expense: 2_400_000, from: "2026-10-08", to: "2026-10-08" });
    expect(stats.week).toEqual({ income: 7_970_000, expense: 2_400_000, from: "2026-10-05", to: "2026-10-08" });
    expect(stats.month).toEqual({ income: 7_970_000, expense: 2_900_000, from: "2026-10-01", to: "2026-10-08" });
    expect(filterRowsFrom(rows, "2026-10-01", NOW)).toHaveLength(4);
  });
});

describe("mainCashboxStats — sources", () => {
  it("groups by source_type, largest first, with shares; transfers keep their own source", () => {
    const rows = [
      row({ amount: 18_400_000, operation_type: "income", source_type: "courier_payment" }),
      row({ amount: 16_000_000, operation_type: "income", source_type: "branch_to_main" }),
      row({ amount: 4_000_000, operation_type: "income", source_type: "manual_income" }),
      row({ amount: 2_000_000, operation_type: "income", source_type: "Manual_Income" }),
      row({ amount: 16_500_000, operation_type: "expense", source_type: "market_payment" }),
      row({ amount: 0, operation_type: "income", source_type: "correction" }),
    ];

    const income = groupBySource(rows, "income");
    expect(income.map((bucket) => bucket.sourceType)).toEqual(["courier_payment", "branch_to_main", "manual_income"]);
    expect(income[2].amount).toBe(6_000_000);
    expect(income.reduce((sum, bucket) => sum + bucket.share, 0)).toBeCloseTo(100);

    expect(groupBySource(rows, "expense")).toEqual([
      { sourceType: "market_payment", amount: 16_500_000, share: 100 },
    ]);
  });
});

describe("mainCashboxStats — end-of-day balance series", () => {
  const history = [
    // Javob tartibi — yangisi tepada (gateway `createdAt DESC`).
    { id: "6", operation_type: "income", amount: 1_850_000, balance_after: 24_615_000, createdAt: local(2026, 10, 8, 14, 32) },
    { id: "5", operation_type: "expense", amount: 2_400_000, balance_after: 22_765_000, createdAt: local(2026, 10, 8, 13, 5) },
    { id: "4", operation_type: "expense", amount: 1_500_000, balance_after: 20_045_000, createdAt: local(2026, 10, 7, 18, 40) },
    { id: "3", operation_type: "income", amount: 920_000, balance_after: 21_545_000, createdAt: local(2026, 10, 7, 16, 12) },
    { id: "2", operation_type: "income", amount: 3_000_000, balance_after: 20_625_000, createdAt: local(2026, 10, 5, 10) },
    { id: "1", operation_type: "income", amount: 10_000_000, balance_after: 17_625_000, createdAt: local(2026, 9, 1, 10) },
  ];

  it("last row of each day, carried over days without operations, last 30 days by default", () => {
    const points = buildDailyBalanceSeries(history, { now: NOW, windowDays: 5 });
    expect(points).toEqual([
      // 04.10 — davr boshidan oldingi oxirgi qoldiq (01.09) ko'chadi.
      { date: "2026-10-04", balance: 17_625_000, income: 0, expense: 0 },
      { date: "2026-10-05", balance: 20_625_000, income: 3_000_000, expense: 0 },
      { date: "2026-10-06", balance: 20_625_000, income: 0, expense: 0 },
      { date: "2026-10-07", balance: 20_045_000, income: 920_000, expense: 1_500_000 },
      { date: "2026-10-08", balance: 24_615_000, income: 1_850_000, expense: 2_400_000 },
    ]);
  });

  it("with a date filter: only that range (end capped at today), days before the first known balance are skipped", () => {
    const filtered = history.filter((item) => item.createdAt >= local(2026, 10, 6, 0));
    const points = buildDailyBalanceSeries(filtered, { from: "2026-10-03", to: "2026-10-20", now: NOW });
    expect(points.map((point) => point.date)).toEqual(["2026-10-07", "2026-10-08"]);
    expect(points[0].balance).toBe(20_045_000);
  });

  it("rows without balance_after do not break the series; an empty history gives no points", () => {
    const points = buildDailyBalanceSeries(
      [
        { id: "2", operation_type: "income", amount: 10, createdAt: local(2026, 10, 8, 10) },
        { id: "1", operation_type: "income", amount: 5, balance_after: 100, createdAt: local(2026, 10, 7, 10) },
      ],
      { now: NOW, windowDays: 2 },
    );
    expect(points).toEqual([
      { date: "2026-10-07", balance: 100, income: 5, expense: 0 },
      { date: "2026-10-08", balance: 100, income: 10, expense: 0 },
    ]);
    expect(buildDailyBalanceSeries([], { now: NOW })).toEqual([]);
  });
});
