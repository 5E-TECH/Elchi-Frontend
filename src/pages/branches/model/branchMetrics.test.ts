import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeDashboardResponse } from "../../../entities/dashboard";
import {
  branchMetricsParams,
  groupStatusDistribution,
  isEmptyPeriod,
  parseBranchMetricsPeriod,
  readBranchMetrics,
} from "./branchMetrics";

/**
 * 6CYRjoZG — `GET /analytics/dashboard?branch_id=` javobi → «Filial ko'rsatkichlari» (backend FRONTEND_CHANGELOG
 * 2026-10-24, batch D: `dailyRevenue`, `statusDistribution`, `topCouriers`, `branchDashboard`, `previous`, `series`).
 */
const SERIES = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-10-${String(index + 1).padStart(2, "0")}`,
  acceptedCount: 20 + index,
  soldAndPaid: 15 + index,
  cancelled: 2,
  totalRevenue: 3_000_000 + index * 100_000,
  profit: 300_000 + index * 10_000,
  lostRevenue: 0,
}));

const payload = (overrides: Record<string, unknown> = {}) => ({
  statusCode: 200,
  message: "Dashboard infos",
  data: {
    branch_id: "15",
    orders: { acceptedCount: 186, soldAndPaid: 141, cancelled: 17, totalRevenue: 26_400_000, profit: 2_900_000, lostRevenue: 1_200_000 },
    previous: { from: "2026-09-30T19:00:00.000Z", to: "2026-10-04T18:59:59.999Z", acceptedCount: 179, soldAndPaid: 129, cancelled: 15, totalRevenue: 24_400_000, profit: 2_675_000, lostRevenue: 900_000 },
    series: SERIES,
    dailyRevenue: {
      data: [
        { period: "2026-10-05", label: "05.10", ordersCount: 30, revenue: 6_217_000, profit: 700_000 },
        { period: "2026-10-06", label: "06.10", ordersCount: 34, revenue: 6_759_000, profit: 760_000 },
      ],
      summary: { totalRevenue: 12_976_000, totalOrders: 64, avgRevenue: 6_488_000, totalProfit: 1_460_000 },
    },
    statusDistribution: {
      distribution: {
        created: 2, new: 4, received: 0, "on the road": 18, waiting: 3, waiting_customer: 1,
        sold: 120, paid: 18, partly_paid: 3, cancelled: 12, "cancelled (sent)": 3, returned_to_market: 1, closed: 1,
      },
      total: 186,
    },
    topCouriers: [{ courier_id: "209", courier_name: "Bahodir Karimov", total_orders: 71, successful_orders: 58, success_rate: 81.7 }],
    topCouriersMeta: { period_rule: "selected_range", from: "2026-10-05", to: "2026-10-08", min_orders: 5 },
    branchDashboard: { role: "SUPER", stats_unavailable: false, cards: { couriers: { branch_couriers: 3, active_today: 3 } } },
    degraded: false,
    failed_parts: [],
    ...overrides,
  },
});

const read = (overrides?: Record<string, unknown>, branchId = "15") =>
  readBranchMetrics(normalizeDashboardResponse(payload(overrides)), branchId);

describe("branchMetrics — davr", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Payshanba, 08.10.2026 (Toshkent tushdan keyin).
    vi.setSystemTime(new Date(2026, 9, 8, 14, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("URL qiymati: noma'lum yoki bo'sh — sukut «Bu hafta»", () => {
    expect(parseBranchMetricsPeriod("month")).toBe("month");
    expect(parseBranchMetricsPeriod("all")).toBe("all");
    expect(parseBranchMetricsPeriod(null)).toBe("week");
    expect(parseBranchMetricsPeriod("year")).toBe("week");
  });

  it("so'rov parametrlari: filial + sanalar; «Barchasi» — `all=true`", () => {
    expect(branchMetricsParams("15", "today")).toEqual({ branch_id: "15", start_day: "2026-10-08", end_day: "2026-10-08" });
    expect(branchMetricsParams("15", "week")).toEqual({ branch_id: "15", start_day: "2026-10-05", end_day: "2026-10-08" });
    expect(branchMetricsParams("15", "month")).toEqual({ branch_id: "15", start_day: "2026-10-01", end_day: "2026-10-08" });
    expect(branchMetricsParams("15", "all")).toEqual({ branch_id: "15", all: true });
  });
});

describe("branchMetrics — javobni o'qish", () => {
  it("KPI, oldingi davr, seriya, kunlik daromad, holatlar, reyting va kuryerlar belgisi", () => {
    const metrics = read();
    expect(metrics).not.toBeNull();
    expect(metrics!.current).toEqual({ acceptedCount: 186, soldAndPaid: 141, cancelled: 17, totalRevenue: 26_400_000, profit: 2_900_000 });
    expect(metrics!.previous).toEqual({ acceptedCount: 179, soldAndPaid: 129, cancelled: 15, totalRevenue: 24_400_000, profit: 2_675_000 });
    expect(metrics!.series).toHaveLength(14);
    expect(metrics!.series![13]).toMatchObject({ date: "2026-10-14", acceptedCount: 33 });
    expect(metrics!.dailyRevenue).toEqual([
      { period: "2026-10-05", label: "05.10", revenue: 6_217_000, ordersCount: 30 },
      { period: "2026-10-06", label: "06.10", revenue: 6_759_000, ordersCount: 34 },
    ]);
    expect(metrics!.status).toEqual({ total: 186, sold: 141, road: 22, fresh: 6, cancelled: 17 });
    expect(metrics!.topCouriers).toEqual([
      { courier_id: "209", courier_name: "Bahodir Karimov", total_orders: 71, successful_orders: 58, success_rate: 81.7 },
    ]);
    expect(metrics!.topCouriersMeta).toMatchObject({ periodRule: "selected_range", minOrders: 5 });
    expect(metrics!.couriers).toEqual({ total: 3, active: 3 });
    expect(isEmptyPeriod(metrics!)).toBe(false);
  });

  it("backend filialni qo'llamagan (`branch_id` yo'q yoki boshqa) — `null`, kompaniya raqamlari ko'rsatilmaydi", () => {
    expect(read({ branch_id: undefined })).toBeNull();
    expect(read({ branch_id: "16" })).toBeNull();
    expect(read(undefined, "16")).toBeNull();
    expect(readBranchMetrics(undefined, "15")).toBeNull();
    // Raqamli id ham satr bilan mos.
    expect(read({ branch_id: 15 })).not.toBeNull();
  });

  it("olinmagan bo'laklar (`failed_parts`) — `null` (nollar emas)", () => {
    const metrics = read({
      dailyRevenue: null,
      statusDistribution: null,
      topCouriers: null,
      previous: null,
      series: null,
      branchDashboard: null,
      degraded: true,
      failed_parts: ["branchDashboard", "dailyRevenue", "statusDistribution", "topCouriers", "trend"],
    });
    expect(metrics).toMatchObject({
      previous: null,
      series: null,
      dailyRevenue: null,
      status: null,
      topCouriers: null,
      couriers: null,
    });
    // KPI (overview) — sog'.
    expect(metrics!.current.acceptedCount).toBe(186);
  });

  it("`stats_unavailable` — kuryerlar belgisi yo'q; kuryeri yo'q filialda ham", () => {
    expect(read({ branchDashboard: { stats_unavailable: true, cards: { couriers: { branch_couriers: 3, active_today: 0 } } } })!.couriers).toBeNull();
    expect(read({ branchDashboard: { cards: { couriers: { branch_couriers: 0, active_today: 0 } } } })!.couriers).toBeNull();
    expect(read({ branchDashboard: { cards: { couriers: null } } })!.couriers).toBeNull();
  });

  it("«Barchasi»: `previous: null` — delta yo'q; 2 nuqtadan kam seriya — sparkline yo'q", () => {
    const metrics = read({ previous: null, series: [SERIES[0]] });
    expect(metrics!.previous).toBeNull();
    expect(metrics!.series).toBeNull();
  });

  it("bo'sh davr", () => {
    const metrics = read({ orders: { acceptedCount: 0, soldAndPaid: 0, cancelled: 0, totalRevenue: 0, profit: 0 } });
    expect(isEmptyPeriod(metrics!)).toBe(true);
  });
});

describe("groupStatusDistribution", () => {
  it("guruhlar: sotilgan (sold, paid, partly_paid) · yangi (new, created, received) · bekor (cancelled, cancelled (sent), returned_to_market, closed) · qolgani — yo'lda", () => {
    expect(
      groupStatusDistribution({
        distribution: { new: 1, created: 1, received: 2, "on the road": 3, waiting: 1, sold: 5, paid: 1, partly_paid: 1, cancelled: 2, closed: 1 },
        total: 18,
      }),
    ).toEqual({ total: 18, sold: 7, fresh: 4, cancelled: 3, road: 4 });
  });

  it("noma'lum holat «Yo'lda» ga tushadi (yig'indi jamiga teng); `total` kam kelsa — yig'indi", () => {
    expect(groupStatusDistribution({ distribution: { lost_in_transit: 2, sold: 3 }, total: 1 })).toEqual({
      total: 5,
      sold: 3,
      fresh: 0,
      cancelled: 0,
      road: 2,
    });
  });

  it("yozilish shakllari (`on_the_road`, `cancelled_sent`) ham taniladi", () => {
    expect(groupStatusDistribution({ distribution: { cancelled_sent: 2, on_the_road: 1 } })).toEqual({
      total: 3,
      sold: 0,
      fresh: 0,
      cancelled: 2,
      road: 1,
    });
  });

  it("taqsimot yo'q — `null`", () => {
    expect(groupStatusDistribution(null)).toBeNull();
    expect(groupStatusDistribution({ total: 3 })).toBeNull();
  });
});
