import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatShortRange,
  isDashboardQuickKey,
  percentChange,
  previousPeriodRange,
  rangeDays,
  resolveDashboardPeriod,
  splitCompactMoney,
} from "./period";
import { inProgressCount, readProfileBranchName } from "./profile";

describe("dashboard davri", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 8, 12, 0, 0)); // 08.10.2026, payshanba
  });
  afterEach(() => vi.useRealTimers());

  it("bo'sh oraliq — bugun; tez tanlovlar va yil aniqlanadi", () => {
    expect(resolveDashboardPeriod("", "")).toEqual({ kind: "today", range: { from: "2026-10-08", to: "2026-10-08" } });
    expect(resolveDashboardPeriod("2026-10-08", "2026-10-08").kind).toBe("today");
    expect(resolveDashboardPeriod("2026-10-05", "2026-10-08").kind).toBe("week");
    expect(resolveDashboardPeriod("2026-10-01", "2026-10-08").kind).toBe("month");
    expect(resolveDashboardPeriod("1970-01-01", "2026-10-08").kind).toBe("all");
    expect(resolveDashboardPeriod("2025-01-01", "2025-12-31")).toMatchObject({ kind: "year", year: 2025 });
    expect(resolveDashboardPeriod("2026-09-25", "2026-10-08").kind).toBe("custom");
  });

  it("oldingi teng davr: bugun → kecha, 14 kun → oldingi 14 kun, «Barchasi» — yo'q", () => {
    expect(previousPeriodRange(resolveDashboardPeriod("", ""))).toEqual({ from: "2026-10-07", to: "2026-10-07" });
    expect(previousPeriodRange(resolveDashboardPeriod("2026-09-25", "2026-10-08"))).toEqual({
      from: "2026-09-11",
      to: "2026-09-24",
    });
    expect(previousPeriodRange(resolveDashboardPeriod("1970-01-01", "2026-10-08"))).toBeNull();
  });

  it("qisqa oraliq matni (maket: «25.09 – 08.10»)", () => {
    expect(formatShortRange({ from: "2026-09-25", to: "2026-10-08" })).toBe("25.09 – 08.10");
    expect(formatShortRange({ from: "2026-10-08", to: "2026-10-08" })).toBe("08.10.2026");
    expect(formatShortRange({ from: "2025-12-28", to: "2026-01-05" })).toBe("28.12.2025 – 05.01.2026");
    expect(rangeDays({ from: "2026-09-25", to: "2026-10-08" })).toBe(14);
  });
});

describe("dashboard davri — bosilgan tez tanlov (dushanba, oyning 1-kuni)", () => {
  afterEach(() => vi.useRealTimers());
  const at = (date: Date) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date);
  };

  it("⭐ dushanba: «Bu hafta» oralig'i «Bugun» bilan bir xil — bosilgani qaytadi, bosilmagan bo'lsa «Bugun»", () => {
    at(new Date(2026, 9, 26, 12));
    expect(resolveDashboardPeriod("2026-10-26", "2026-10-26").kind).toBe("today");
    expect(resolveDashboardPeriod("2026-10-26", "2026-10-26", "week").kind).toBe("week");
    expect(resolveDashboardPeriod("2026-10-26", "2026-10-26", "today").kind).toBe("today");
  });

  it("⭐ oyning 1-kuni: «Bu oy»", () => {
    at(new Date(2026, 9, 1, 12)); // payshanba
    expect(resolveDashboardPeriod("2026-10-01", "2026-10-01", "month").kind).toBe("month");
  });

  it("bosilgan tanlov oraliq unga teng bo'lmasa e'tiborsiz (sana qo'lda o'zgargan yoki kun almashgan)", () => {
    at(new Date(2026, 9, 27, 12)); // seshanba: «Bu hafta» endi 26–27
    expect(resolveDashboardPeriod("2026-10-26", "2026-10-26", "week").kind).toBe("custom");
    expect(resolveDashboardPeriod("2026-10-27", "2026-10-27", "month").kind).toBe("today");
  });

  it("redux qiymati tekshiriladi: faqat to'rt tez tanlov", () => {
    for (const key of ["today", "week", "month", "all"]) expect(isDashboardQuickKey(key)).toBe(true);
    for (const value of ["year", "custom", "", null, undefined, 1]) expect(isDashboardQuickKey(value)).toBe(false);
  });
});

describe("dashboard hisoblari", () => {
  it("foiz o'zgarishi: asos 0 yoki yo'q — null", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(75, 100)).toBe(-25);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(10, undefined)).toBeNull();
  });

  it("ixcham pul StatCard uchun: qiymat + birlik", () => {
    expect(splitCompactMoney(48_600_000, "uz")).toEqual({ value: "48,6", unit: "mln so'm" });
    expect(splitCompactMoney(950, "uz")).toEqual({ value: "950", unit: "so'm" });
    expect(splitCompactMoney(-4_900_000, "uz")).toEqual({ value: "−4,9", unit: "mln so'm" });
    expect(splitCompactMoney(48_600_000, "ru")).toEqual({ value: "48,6", unit: "млн сум" });
    expect(splitCompactMoney(48_600_000, "en")).toEqual({ value: "48.6M", unit: "UZS" });
  });

  it("jarayonda = qabul − sotilgan − bekor (manfiy emas)", () => {
    expect(inProgressCount(312, 241, 25)).toBe(46);
    expect(inProgressCount(5, 4, 3)).toBe(0);
  });

  it("profil filiali: branch.branch.name → branch.name → branch_name", () => {
    expect(readProfileBranchName({ branch: { branch: { name: "Urgut filiali" } } })).toBe("Urgut filiali");
    expect(readProfileBranchName({ branch: { name: " Toshkent HQ " } })).toBe("Toshkent HQ");
    expect(readProfileBranchName({ branch_name: "Samarqand" })).toBe("Samarqand");
    expect(readProfileBranchName(null)).toBeNull();
  });
});
