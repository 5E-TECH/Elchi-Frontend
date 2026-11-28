import { describe, expect, it } from "vitest";
import { normalizeFinancePnl, pnlFromDay } from "./financePnl";

const item = (period: string, gross: number, opex: number, otherIncome = 0) => ({
  period,
  gross,
  opex,
  net: gross - opex,
  other_income: otherIncome,
});

describe("normalizeFinancePnl", () => {
  it("oylar va jami serverdan; qo'lda kirim alohida", () => {
    const parsed = normalizeFinancePnl({
      statusCode: 200,
      data: {
        from_day: "2026-09-01",
        to_day: "2026-11-28",
        granularity: "month",
        items: [item("2026-09", 41_250_000, 18_400_000, 5_000_000), item("2026-10", 0, 0), item("2026-11", 38_900_000, 41_300_000)],
        totals: { gross: 80_150_000, opex: 59_700_000, net: 20_450_000, other_income: 5_000_000 },
      },
    });
    expect(parsed).toEqual({
      from: "2026-09-01",
      to: "2026-11-28",
      months: [
        { month: "2026-09", gross: 41_250_000, opex: 18_400_000, net: 22_850_000, otherIncome: 5_000_000 },
        { month: "2026-10", gross: 0, opex: 0, net: 0, otherIncome: 0 },
        { month: "2026-11", gross: 38_900_000, opex: 41_300_000, net: -2_400_000, otherIncome: 0 },
      ],
      totals: { gross: 80_150_000, opex: 59_700_000, net: 20_450_000, otherIncome: 5_000_000 },
    });
  });

  it("satr ko'rinishidagi son va jami yo'q bo'lsa — oylardan", () => {
    const parsed = normalizeFinancePnl({
      data: { items: [{ period: "2026-11", gross: "100.5", opex: "40" }] },
    });
    expect(parsed?.months[0]).toEqual({ month: "2026-11", gross: 100.5, opex: 40, net: 60.5, otherIncome: 0 });
    expect(parsed?.totals).toEqual({ gross: 100.5, opex: 40, net: 60.5, otherIncome: 0 });
  });

  it.each([
    [{ data: {} }],
    [null],
    [{ data: { items: [{ period: "2026-11-01", gross: 1, opex: 0 }] } }],
    [{ data: { items: [{ period: "2026-13", gross: 1, opex: 0 }] } }],
    [{ data: { items: [{ period: "2026-11", gross: "abc", opex: 0 }] } }],
    [{ data: { items: [item("2026-10", 1, 0), { period: "2026-11", opex: 0 }] } }],
  ])("buzuq javob → null: %j", (response) => {
    expect(normalizeFinancePnl(response)).toBeNull();
  });
});

describe("pnlFromDay", () => {
  it.each([
    [12, "2026-11-28", "2025-12-01"],
    [6, "2026-11-28", "2026-06-01"],
    [24, "2026-11-28", "2024-12-01"],
    [12, "2026-01-05", "2025-02-01"],
    [1, "2026-03-31", "2026-03-01"],
  ])("%i oy, bugun %s → %s", (months, today, expected) => {
    expect(pnlFromDay(months, today)).toBe(expected);
  });
});
