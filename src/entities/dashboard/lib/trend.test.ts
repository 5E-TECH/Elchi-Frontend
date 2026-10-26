import { describe, expect, it } from "vitest";
import { normalizeDashboardResponse, normalizeKpiResponse, normalizeRevenueResponse } from "../index";
import { clampedAllTimeWindow } from "./allTime";
import { seriesValues } from "./trend";

const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;

describe("dashboard trend (DwrMygfo) va maqsad (l9NNdsCH) — normalizatsiya", () => {
  it("`previous`, `series` (sana bo'yicha tartiblangan), `targets`, `orders.lostRevenue` o'qiladi", () => {
    const response = normalizeDashboardResponse({
      statusCode: 200,
      data: {
        orders: { acceptedCount: 12, soldAndPaid: 5, cancelled: 2, profit: 480000, totalRevenue: 960000, lostRevenue: "150000" },
        previous: { from: "2026-10-20T19:00:00.000Z", to: "2026-10-21T18:59:59.999Z", acceptedCount: 10, soldAndPaid: 4, cancelled: 1, totalRevenue: 800000, profit: 400000, lostRevenue: 200000 },
        series: [
          { date: day(21), acceptedCount: 2, soldAndPaid: 1, cancelled: 0, totalRevenue: 20, profit: 2, lostRevenue: 0 },
          { date: day(20), acceptedCount: 1, soldAndPaid: 1, cancelled: 0, totalRevenue: 10, profit: 1, lostRevenue: 5 },
          { acceptedCount: 99 },
        ],
        targets: { successRate: 80 },
        degraded: false,
        failed_parts: [],
      },
    });
    const data = response.data;
    expect(data.orders.lostRevenue).toBe(150000);
    expect(data.previous).toMatchObject({ acceptedCount: 10, soldAndPaid: 4, totalRevenue: 800000, profit: 400000, lostRevenue: 200000 });
    expect(data.series?.map((point) => point.date)).toEqual([day(20), day(21)]);
    expect(data.targets).toEqual({ successRate: 80 });
  });

  it("`failed_parts: trend` — `previous` va `series` `null` (0 bilan solishtirilmaydi), qolgan bo'laklar joyida", () => {
    const { data } = normalizeDashboardResponse({
      data: {
        orders: { acceptedCount: 1 },
        previous: { acceptedCount: 3 },
        series: [{ date: day(1) }, { date: day(2) }],
        degraded: true,
        failed_parts: ["trend"],
      },
    });
    expect(data.previous).toBeNull();
    expect(data.series).toBeNull();
    expect(data.failedParts).toEqual(["trend"]);
    expect(data.orders.acceptedCount).toBe(1);
  });

  it("registrator: moliyaviy maydonlar yo'q — `null` (0 emas); «Barchasi» `previous: null`; eski javob — `lostRevenue: null`", () => {
    const { data } = normalizeDashboardResponse({
      data: {
        orders: { acceptedCount: 4, soldAndPaid: 2, cancelled: 1 },
        previous: null,
        series: [
          { date: day(1), acceptedCount: 1, soldAndPaid: 1, cancelled: 0 },
          { date: day(2), acceptedCount: 3, soldAndPaid: 1, cancelled: 1 },
        ],
      },
    });
    expect(data.orders.lostRevenue).toBeNull();
    expect(data.previous).toBeNull();
    expect(data.series?.[0]).toMatchObject({ acceptedCount: 1, totalRevenue: null, profit: null, lostRevenue: null });
    expect(seriesValues(data.series, (point) => point.totalRevenue)).toBeNull();
    expect(seriesValues(data.series, (point) => point.acceptedCount)).toEqual([1, 3]);
  });

  it("`targets.successRate` noto'g'ri (0, >100, satr emas son) — `null`", () => {
    expect(normalizeDashboardResponse({ data: { targets: { successRate: 0 } } }).data.targets).toEqual({ successRate: null });
    expect(normalizeDashboardResponse({ data: { targets: { successRate: 120 } } }).data.targets).toEqual({ successRate: null });
    expect(normalizeDashboardResponse({ data: { targets: { success_rate: "75" } } }).data.targets).toEqual({ successRate: 75 });
    expect(normalizeDashboardResponse({ data: {} }).data.targets).toBeNull();
  });

  it("seriya 2 nuqtadan kam — `null` (chiziq chizilmaydi)", () => {
    const { data } = normalizeDashboardResponse({ data: { series: [{ date: day(1), totalRevenue: 5 }] } });
    expect(data.series).toBeNull();
    expect(seriesValues(null, () => 1)).toBeNull();
  });
});

describe("kpi trend (DwrMygfo) va «Barchasi» (XdKajqLe)", () => {
  it("`previous` / `series` va qisqartirilgan oraliq (`clamped`, `effective_from/to`)", () => {
    const { data } = normalizeKpiResponse({
      statusCode: 200,
      message: "KPI stats (oxirgi 366 kun)",
      data: {
        averageOrderValue: 96000,
        averageFulfillmentHours: 5,
        onTimeRate: 80,
        deliveryCount: 10,
        cancellationRate: 10,
        courierEfficiency: 3,
        marketRating: [],
        previous: { from: "a", to: "b", averageOrderValue: "80000", averageFulfillmentHours: 6, onTimeRate: 70, deliveryCount: 0, cancellationRate: 12 },
        series: [
          { date: day(1), averageOrderValue: 1, averageFulfillmentHours: 0, onTimeRate: 0, deliveryCount: 0, cancellationRate: 0 },
          { date: day(2), averageOrderValue: 2, averageFulfillmentHours: 0, onTimeRate: 0, deliveryCount: 1, cancellationRate: 0 },
        ],
        clamped: true,
        effective_from: "2025-10-21T19:00:00.000Z",
        effective_to: "2026-10-21T18:59:59.999Z",
        max_span_days: 366,
      },
    });
    expect(data.previous).toMatchObject({ averageOrderValue: 80000, deliveryCount: 0, cancellationRate: 12 });
    expect(seriesValues(data.series, (point) => point.averageOrderValue)).toEqual([1, 2]);
    expect(data.appliedRange).toEqual({ clamped: true, from: "2025-10-22", to: "2026-10-21" });
    expect(clampedAllTimeWindow(data.appliedRange)).toEqual({ range: { from: "2025-10-22", to: "2026-10-21" }, days: 365 });
  });

  it("qisqartirilmagan (`clamped: false`) yoki meta yo'q — izoh yo'q", () => {
    expect(normalizeKpiResponse({ data: { clamped: false, effective_from: "2026-01-01" } }).data.appliedRange).toBeNull();
    expect(clampedAllTimeWindow(null)).toBeNull();
    expect(clampedAllTimeWindow({ clamped: true, from: null, to: null })).toBeNull();
  });
});

describe("revenue «Sof foyda» (l9NNdsCH)", () => {
  it("`summary.totalProfit`, `chart.profitValues` va «Barchasi» oralig'i o'qiladi; eski javobda — `null`", () => {
    const { data } = normalizeRevenueResponse({
      data: {
        summary: { totalRevenue: 10, totalOrders: 2, avgRevenue: 5, totalProfit: "4" },
        chart: { labels: ["01.10", "02.10"], values: [4, 6], profitValues: [1, "3"] },
        clamped: true,
        effective_from: "2025-10-21",
        effective_to: "2026-10-21",
      },
    });
    expect(data.summary?.totalProfit).toBe(4);
    expect(data.chart?.profitValues).toEqual([1, 3]);
    expect(data.appliedRange).toEqual({ clamped: true, from: "2025-10-21", to: "2026-10-21" });

    const legacy = normalizeRevenueResponse({ data: { summary: { totalRevenue: 1 }, chart: { labels: [], values: [] } } }).data;
    expect(legacy.summary?.totalProfit).toBeNull();
    expect(legacy.chart?.profitValues).toBeNull();
  });
});
