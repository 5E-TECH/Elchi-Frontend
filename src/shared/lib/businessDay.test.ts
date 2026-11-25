import { afterEach, describe, expect, it, vi } from "vitest";
import {
  businessDayKey,
  businessDayStartMs,
  businessToday,
  currentBusinessDayChangeTime,
  getBusinessDaySchedule,
  normalizeBusinessDaySchedule,
  setBusinessDaySchedule,
  type BusinessDayRule,
} from "./businessDay";
import { getThisMonthRange, getThisWeekRange, getTodayRange } from "./dateRange";

/** Toshkent mahalliy vaqti → lahza. */
const tk = (local: string) => new Date(`${local.replace(" ", "T")}:00+05:00`);

const FIVE: BusinessDayRule[] = [{ from: "2026-01-01", time: "05:00" }];

afterEach(() => {
  setBusinessDaySchedule([]);
  vi.useRealTimers();
});

describe("businessDay (xhiXv3w3) — backend `business-day.ts` bilan ayni qoida", () => {
  it("05:00: 00:59 va 01:30 dagi buyurtmalar KECHAGI ish kuniga tushadi, 05:00 — yangi kun", () => {
    expect(businessDayKey(tk("2026-11-27 00:59"), FIVE)).toBe("2026-11-26");
    expect(businessDayKey(tk("2026-11-27 01:30"), FIVE)).toBe("2026-11-26");
    expect(businessDayKey(tk("2026-11-27 04:59"), FIVE)).toBe("2026-11-26");
    expect(businessDayKey(tk("2026-11-27 05:00"), FIVE)).toBe("2026-11-27");
    expect(businessDayStartMs("2026-11-27", FIVE)).toBe(tk("2026-11-27 05:00").getTime());
  });

  it("18:00: kun kecha 18:00 da boshlanadi", () => {
    const rules: BusinessDayRule[] = [{ from: "2026-01-01", time: "18:00" }];
    expect(businessDayKey(tk("2026-11-26 17:59"), rules)).toBe("2026-11-26");
    expect(businessDayKey(tk("2026-11-26 18:00"), rules)).toBe("2026-11-27");
    expect(businessDayStartMs("2026-11-27", rules)).toBe(tk("2026-11-26 18:00").getTime());
  });

  it("o'tish kuni: 27-noyabrdan 05:00 — 26-noyabr 29 soat, uzilish yo'q", () => {
    const rules: BusinessDayRule[] = [{ from: "2026-11-27", time: "05:00" }];
    expect(businessDayStartMs("2026-11-26", rules)).toBe(tk("2026-11-26 00:00").getTime());
    expect(businessDayStartMs("2026-11-27", rules)).toBe(tk("2026-11-27 05:00").getTime());
    expect(businessDayKey(tk("2026-11-27 03:00"), rules)).toBe("2026-11-26");
    expect(businessDayKey(tk("2026-11-27 06:00"), rules)).toBe("2026-11-27");
    expect(currentBusinessDayChangeTime(tk("2026-11-26 12:00"), rules)).toBe("00:00");
    expect(currentBusinessDayChangeTime(tk("2026-11-27 12:00"), rules)).toBe("05:00");
  });

  it("qoida yo'q (00:00) — qurilmaning kalendar sanasi, avvalgidek", () => {
    const now = new Date(2026, 10, 27, 1, 30);
    expect(businessDayKey(now, [])).toBe("2026-11-27");
    expect(businessToday(now)).toBe("2026-11-27");
    expect(currentBusinessDayChangeTime(now, [])).toBe("00:00");
  });

  it("normalize: noto'g'ri qatorlar tashlanadi, tartiblanadi, ortiqcha (o'zgarmagan) qoidalar siqiladi", () => {
    expect(
      normalizeBusinessDaySchedule([
        { from: "2026-12-01", time: "00:00" },
        { from: "2026-11-27", time: "05:00" },
        { from: "2026-11-29", time: "05:00" },
        { from: "2026-02-30", time: "05:00" },
        { from: "2026-11-28", time: "24:00" },
        null,
      ]),
    ).toEqual([
      { from: "2026-11-27", time: "05:00" },
      { from: "2026-12-01", time: "00:00" },
    ]);
    expect(normalizeBusinessDaySchedule("yomon")).toEqual([]);
    expect(normalizeBusinessDaySchedule([{ from: "2026-11-27", time: "00:00" }])).toEqual([]);
  });

  it("jadval o'rnatilganda «Bugun / Bu hafta / Bu oy» ish kuni bo'yicha", () => {
    setBusinessDaySchedule(FIVE);
    expect(getBusinessDaySchedule()).toEqual(FIVE);
    // 30-noyabr (dushanba) 01:30 — hali 29-noyabr (yakshanba) ish kuni: hafta o'tgan dushanbadan.
    vi.useFakeTimers();
    vi.setSystemTime(tk("2026-11-30 01:30"));
    expect(businessToday()).toBe("2026-11-29");
    expect(getTodayRange()).toEqual({ from: "2026-11-29", to: "2026-11-29" });
    expect(getThisWeekRange()).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    expect(getThisMonthRange()).toEqual({ from: "2026-11-01", to: "2026-11-29" });
    // 1-dekabr 01:30 — hali noyabr oyi.
    vi.setSystemTime(tk("2026-12-01 01:30"));
    expect(getThisMonthRange()).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });
});
