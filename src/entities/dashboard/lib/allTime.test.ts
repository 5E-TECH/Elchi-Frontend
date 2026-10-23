import { describe, expect, it } from "vitest";
import { getAllTimeRange, getTodayRange } from "../../../shared/lib/dateRange";
import { normalizeDashboardResponse } from "../index";
import { buildDashboardDateParams, getEffectiveAllTimeRange, readAppliedRange } from "./allTime";

/** tya24blo — «Barchasi» hamma rolda `all=true`; backend qisqartirgan haqiqiy oraliq sana maydonida. */
describe("buildDashboardDateParams", () => {
  it("«Barchasi» — `{ all: true }` (`start_day=1970-01-01` emas)", () => {
    const all = getAllTimeRange();
    expect(buildDashboardDateParams(all.from, all.to)).toEqual({ all: true });
  });

  it("oraliq — `start_day` / `end_day`; bo'sh — bo'sh satrlar (backend sukuti — bugun)", () => {
    expect(buildDashboardDateParams("2026-10-01", "2026-10-08")).toEqual({ start_day: "2026-10-01", end_day: "2026-10-08" });
    expect(buildDashboardDateParams("", "")).toEqual({ start_day: "", end_day: "" });
  });
});

describe("readAppliedRange", () => {
  it("yuqori daraja: `clamped`, `effective_from`, `effective_to`", () => {
    expect(readAppliedRange({ clamped: true, effective_from: "2025-10-21", effective_to: "2026-10-21", max_span_days: 366 })).toEqual({
      clamped: true,
      from: "2025-10-21",
      to: "2026-10-21",
    });
  });

  it("market / menejer javobi: meta `myStat.applied_range` yoki `orders.applied_range` ichida", () => {
    expect(readAppliedRange({ myStat: { applied_range: { clamped: true, effective_from: "2025-10-22" } } })).toEqual({
      clamped: true,
      from: "2025-10-22",
      to: null,
    });
    expect(readAppliedRange({ orders: { applied_range: { clamped: true, from: "2025-10-22", to: "2026-10-22" } } })).toEqual({
      clamped: true,
      from: "2025-10-22",
      to: "2026-10-22",
    });
  });

  it("to'liq vaqt — Toshkent kuni (UTC kuni emas)", () => {
    // 2025-10-20 19:00 UTC = Toshkentda 21-oktabr 00:00.
    expect(readAppliedRange({ clamped: true, effective_from: "2025-10-20T19:00:00.000Z" })?.from).toBe("2025-10-21");
  });

  it("qisqartirilmagan yoki meta yo'q — `null`", () => {
    expect(readAppliedRange({ clamped: false, effective_from: "2025-10-21" })).toBeNull();
    expect(readAppliedRange({ orders: { acceptedCount: 3 } })).toBeNull();
    expect(readAppliedRange(null)).toBeNull();
  });

  it("normalizeDashboardResponse xom `myStat.applied_range` ni yo'qotmaydi (`myStat` qayta quriladi)", () => {
    const normalized = normalizeDashboardResponse({
      statusCode: 200,
      data: {
        myStat: { totalOrders: 4, applied_range: { clamped: true, effective_from: "2025-10-22", effective_to: "2026-10-22" } },
      },
    });
    expect(normalized.data.myStat).not.toHaveProperty("applied_range");
    expect(normalized.data.appliedRange).toEqual({ clamped: true, from: "2025-10-22", to: "2026-10-22" });
  });

  it("meta javob ildizida (`data` yonida, prod 2026-10-22 shakli) — UTC vaqt Toshkent kuniga", () => {
    const normalized = normalizeDashboardResponse({
      statusCode: 200,
      clamped: true,
      effective_from: "2025-10-21T19:00:00.000Z",
      effective_to: "2026-10-22",
      max_span_days: 366,
      data: { orders: { acceptedCount: 3 } },
    });
    expect(normalized.data.appliedRange).toEqual({ clamped: true, from: "2025-10-22", to: "2026-10-22" });
  });
});

describe("getEffectiveAllTimeRange", () => {
  const all = getAllTimeRange();

  it("faqat «Barchasi» va `clamped` bo'lsa; `effective_to` yo'q — bugun", () => {
    expect(getEffectiveAllTimeRange(all.from, all.to, { clamped: true, from: "2025-10-21", to: "2026-10-20" })).toEqual({
      from: "2025-10-21",
      to: "2026-10-20",
    });
    expect(getEffectiveAllTimeRange(all.from, all.to, { clamped: true, from: "2025-10-21", to: null })).toEqual({
      from: "2025-10-21",
      to: getTodayRange().to,
    });
  });

  it("boshqa davr, qisqartirilmagan yoki boshlanishsiz — `null` (maydon «Barchasi»dagidek bo'sh)", () => {
    expect(getEffectiveAllTimeRange("2026-10-01", "2026-10-08", { clamped: true, from: "2025-10-21", to: null })).toBeNull();
    expect(getEffectiveAllTimeRange(all.from, all.to, { clamped: false, from: "2025-10-21", to: null })).toBeNull();
    expect(getEffectiveAllTimeRange(all.from, all.to, { clamped: true, from: null, to: "2026-10-20" })).toBeNull();
    expect(getEffectiveAllTimeRange(all.from, all.to, null)).toBeNull();
  });
});
