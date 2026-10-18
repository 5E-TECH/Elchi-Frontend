import { describe, expect, it } from "vitest";
import { calcEarnedSalary, calcSalaryCycle, toPaymentDay } from "./salaryCycle";

/** Mahalliy vaqt (`new Date(y, m, d, h)`) — davr chegaralari ham mahalliy yarim tunda. */
const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour);

describe("calcSalaryCycle (UserStatsCard.calcCycleProgress dan ko'chirilgan)", () => {
  it("to'lov kuni o'tgan: davr shu oyning to'lov kunidan keyingi oyning shu kunigacha", () => {
    const cycle = calcSalaryCycle(25, at(2026, 10, 9));
    // Bugun 9 < 25 — davr 25.09 dan 25.10 gacha.
    expect(cycle.start).toEqual(new Date(2026, 8, 25));
    expect(cycle.end).toEqual(new Date(2026, 9, 25));
    expect(cycle.totalDays).toBe(30);
    expect(cycle.passedDays).toBe(15);
    expect(cycle.remainDays).toBe(15);
    expect(cycle.progress).toBeGreaterThan(48);
    expect(cycle.progress).toBeLessThan(49);
  });

  it("to'lov kunining o'zida yangi davr boshlanadi", () => {
    const cycle = calcSalaryCycle(10, at(2026, 10, 10, 0));
    expect(cycle.start).toEqual(new Date(2026, 9, 10));
    expect(cycle.end).toEqual(new Date(2026, 10, 10));
    expect(cycle.passedDays).toBe(0);
    expect(cycle.remainDays).toBe(31);
    expect(cycle.progress).toBe(0);
  });

  it("yanvar boshida davr o'tgan yilning dekabridan boshlanadi", () => {
    const cycle = calcSalaryCycle(15, at(2027, 1, 3));
    expect(cycle.start).toEqual(new Date(2026, 11, 15));
    expect(cycle.end).toEqual(new Date(2027, 0, 15));
  });

  it("foiz 100 dan oshmaydi", () => {
    expect(calcSalaryCycle(1, at(2026, 10, 31, 23)).progress).toBeLessThanOrEqual(100);
  });
});

describe("calcEarnedSalary", () => {
  it("floor(maosh × o'tgan qism)", () => {
    expect(calcEarnedSalary(6_000_000, 46.7)).toBe(2_802_000);
    expect(calcEarnedSalary(1_000_001, 33.333)).toBe(333_330);
    expect(calcEarnedSalary(5_000_000, 0)).toBe(0);
  });
});

describe("toPaymentDay", () => {
  it("noto'g'ri qiymat — 1", () => {
    expect(toPaymentDay(null)).toBe(1);
    expect(toPaymentDay("abc")).toBe(1);
    expect(toPaymentDay(0)).toBe(1);
    expect(toPaymentDay("25")).toBe(25);
    expect(toPaymentDay(12)).toBe(12);
  });
});
