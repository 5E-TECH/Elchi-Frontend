import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  clampDay,
  countDays,
  endOfWeek,
  formatRangeFull,
  formatRangeShort,
  getPresetRange,
  isoDayToDate,
  matchPreset,
  resolvePreset,
  normalizeISODay,
  normalizeRange,
  parseISODay,
  pluralForm,
  startOfWeek,
  toISODay,
  weekdayIndex,
} from "./calendarMath";

describe("calendarMath — kalendar kunlari", () => {
  it("qat'iy parse: yo'q sana, boshqa format — null; ISO sana-vaqtdan sana qismi", () => {
    expect(parseISODay("2026-10-08")).toEqual({ y: 2026, m: 10, d: 8 });
    expect(parseISODay("2026-02-30")).toBeNull();
    expect(parseISODay("2026-13-01")).toBeNull();
    expect(parseISODay("08.10.2026")).toBeNull();
    expect(parseISODay("")).toBeNull();
    expect(normalizeISODay("2026-10-08T23:59:59")).toBe("2026-10-08");
    expect(normalizeISODay("2024-02-29")).toBe("2024-02-29");
    expect(normalizeISODay("2025-02-29")).toBe("");
  });

  it("Date ↔ satr — mahalliy kalendar kuni", () => {
    expect(toISODay(new Date(2026, 9, 8, 23, 30))).toBe("2026-10-08");
    const date = isoDayToDate("2026-10-08");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(8);
    expect(date?.getHours()).toBe(0);
    expect(isoDayToDate("x")).toBeNull();
  });

  it("kun va oy qo'shish — oy/yil chegarasi, oy oxiriga qisqarish", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-10-08", 12)).toBe("2027-10-08");
  });

  it("hafta dushanbadan: 08.10.2026 — payshanba", () => {
    expect(weekdayIndex("2026-10-08")).toBe(3);
    expect(startOfWeek("2026-10-08")).toBe("2026-10-05");
    expect(endOfWeek("2026-10-08")).toBe("2026-10-11");
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05"); // yakshanba — o'sha haftaning oxiri
  });

  it("oy to'ri — 42 katak, maketdagidek (oktabr 2026: 28, 29, 30 sentabr bilan boshlanadi)", () => {
    const grid = buildMonthGrid("2026-10-01");
    expect(grid).toHaveLength(42);
    expect(grid.slice(0, 4).map((cell) => [cell.date, cell.inMonth])).toEqual([
      [28, false],
      [29, false],
      [30, false],
      [1, true],
    ]);
    expect(grid.at(-1)).toEqual({ day: "2026-11-08", date: 8, inMonth: false });
    // Noyabr 2026 — 26.10 dan boshlanadi (maket).
    expect(buildMonthGrid("2026-11-15")[0].day).toBe("2026-10-26");
  });

  it("kunlar soni ikkala chekka bilan; teskari oraliq almashtiriladi; chegara", () => {
    expect(countDays("2026-10-01", "2026-10-08")).toBe(8);
    expect(countDays("2026-03-28", "2026-03-30")).toBe(3);
    expect(normalizeRange({ from: "2026-10-08", to: "2026-10-01" })).toEqual({ from: "2026-10-01", to: "2026-10-08" });
    expect(normalizeRange({ from: "bad", to: "2026-10-01" })).toEqual({ from: "", to: "2026-10-01" });
    expect(normalizeRange(null)).toEqual({ from: "", to: "" });
    expect(clampDay("2026-10-01", "2026-10-05")).toBe("2026-10-05");
    expect(clampDay("2026-10-30", undefined, "2026-10-20")).toBe("2026-10-20");
  });
});

describe("calendarMath — tez tanlov", () => {
  const today = "2026-10-08"; // payshanba

  it("davrlar (hafta dushanbadan, oy 1-kunidan bugungacha)", () => {
    expect(getPresetRange("today", today)).toEqual({ from: today, to: today });
    expect(getPresetRange("yesterday", today)).toEqual({ from: "2026-10-07", to: "2026-10-07" });
    expect(getPresetRange("week", today)).toEqual({ from: "2026-10-05", to: today });
    expect(getPresetRange("lastWeek", today)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(getPresetRange("month", today)).toEqual({ from: "2026-10-01", to: today });
    expect(getPresetRange("lastMonth", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(getPresetRange("year", today)).toEqual({ from: "2026-01-01", to: today });
    expect(getPresetRange("all", today)).toEqual({ from: "", to: "" });
  });

  it("joriy oraliqqa mos davr — chip aria-pressed", () => {
    const presets = ["today", "week", "month", "all"] as const;
    expect(matchPreset({ from: "2026-10-01", to: today }, presets, today)).toBe("month");
    expect(matchPreset({ from: "", to: "" }, presets, today)).toBe("all");
    expect(matchPreset({ from: "2026-10-02", to: today }, presets, today)).toBeNull();
  });

  it("⭐ bosilgan chip (dushanba «Bu hafta», 1-kun «Bu oy» = «Bugun» oralig'i) — o'zi; teng bo'lmasa — birinchi mosi", () => {
    const presets = ["today", "week", "month", "all"] as const;
    const monday = "2026-10-26";
    const mondayRange = { from: monday, to: monday };
    expect(matchPreset(mondayRange, presets, monday)).toBe("today");
    expect(resolvePreset(mondayRange, presets, "week", monday)).toBe("week");
    expect(resolvePreset(mondayRange, presets, "today", monday)).toBe("today");
    expect(resolvePreset(mondayRange, presets, null, monday)).toBe("today");
    expect(resolvePreset({ from: "2026-10-01", to: "2026-10-01" }, presets, "month", "2026-10-01")).toBe("month");
    // Oraliq bosilgan chipnikiga teng emas (sana qo'lda tanlangan) yoki chip ro'yxatda yo'q — oddiy moslik.
    expect(resolvePreset({ from: "2026-10-20", to: monday }, presets, "week", monday)).toBeNull();
    expect(resolvePreset(mondayRange, ["today", "month"], "week", monday)).toBe("today");
  });
});

describe("calendarMath — ko'rinish", () => {
  it("maydon: bir yil ichida boshlanishda yil yo'q (maket «01.10 – 08.10.2026»)", () => {
    expect(formatRangeShort({ from: "2026-10-01", to: "2026-10-08" })).toBe("01.10 – 08.10.2026");
    expect(formatRangeShort({ from: "2025-12-28", to: "2026-01-05" })).toBe("28.12.2025 – 05.01.2026");
    expect(formatRangeShort({ from: "2026-10-08", to: "2026-10-08" })).toBe("08.10.2026");
    expect(formatRangeShort({ from: "2026-10-08", to: "" })).toBeNull();
  });

  it("panel pasti — to'liq sanalar", () => {
    expect(formatRangeFull({ from: "2026-10-01", to: "2026-10-08" })).toBe("01.10.2026 – 08.10.2026");
  });

  it("ko'plik: ru 1/2/5/11/21/22/112, uz va en", () => {
    expect([1, 2, 5, 11, 21, 22, 112].map((n) => pluralForm("ru", n))).toEqual([
      "one",
      "few",
      "many",
      "many",
      "one",
      "few",
      "many",
    ]);
    expect(pluralForm("en", 1)).toBe("one");
    expect(pluralForm("en", 8)).toBe("many");
    expect(pluralForm("uz", 8)).toBe("many");
  });
});
