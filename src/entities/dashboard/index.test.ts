import { describe, expect, it } from "vitest";
import {
  cleanAnalyticsParams,
  normalizeDashboardResponse,
  normalizeKpiResponse,
  normalizeRevenueResponse,
} from "./index";

describe("dashboard response normalization", () => {
  it("does not send empty date filters to analytics endpoints", () => {
    expect(cleanAnalyticsParams({ start_day: "", end_day: "" })).toBeUndefined();
    expect(cleanAnalyticsParams({ period: "daily", start_day: "" })).toEqual({
      period: "daily",
    });
  });

  it("normalizes numeric strings and snake_case dashboard fields", () => {
    const result = normalizeDashboardResponse({
      statusCode: 200,
      data: {
        orders: {
          accepted_count: "12",
          sold_and_paid: "5",
          cancelled_count: "2",
          profit: "480000",
        },
        top_markets: [
          {
            market_id: 7,
            market_name: "Market",
            total_orders: "10",
            successful_orders: "8",
            success_rate: "80",
          },
        ],
      },
    });

    expect(result.data.orders).toMatchObject({
      acceptedCount: 12,
      soldAndPaid: 5,
      cancelled: 2,
      profit: 480000,
    });
    expect(result.data.topMarkets?.[0]).toMatchObject({
      market_id: "7",
      total_orders: 10,
      successful_orders: 8,
      success_rate: 80,
    });
  });

  it("normalizes market dashboard summary aliases", () => {
    const result = normalizeDashboardResponse({
      statusCode: 200,
      data: {
        summary: {
          accepted: "18",
          sold: "11",
          cancelledCount: "3",
          market_profit: "250000",
          revenue: "790000",
        },
      },
    });

    expect(result.data.orders).toMatchObject({
      acceptedCount: 18,
      soldAndPaid: 11,
      cancelled: 3,
      profit: 250000,
      totalRevenue: 790000,
    });
  });

  it("normalizes nested market dashboard order totals", () => {
    const result = normalizeDashboardResponse({
      data: {
        market_dashboard: {
          orders: {
            total_orders: "9",
            successful_orders: "4",
            cancelled_orders: "2",
            netProfit: "135000",
          },
        },
      },
    });

    expect(result.data.orders).toMatchObject({
      acceptedCount: 9,
      soldAndPaid: 4,
      cancelled: 2,
      profit: 135000,
    });
  });

  it("normalizes market dashboard myStat payload", () => {
    const result = normalizeDashboardResponse({
      statusCode: 200,
      message: "Dashboard infos",
      data: {
        myStat: {
          totalOrders: 38,
          soldOrders: 7,
          canceledOrders: 0,
          inProgress: 12,
          profit: 19060000,
          successRate: 18.42,
        },
      },
    });

    expect(result.data.orders).toMatchObject({
      acceptedCount: 38,
      soldAndPaid: 7,
      cancelled: 0,
      inProgress: 12,
      profit: 19060000,
    });
  });

  it("normalizes top branches payload", () => {
    const result = normalizeDashboardResponse({
      statusCode: 200,
      message: "Dashboard infos",
      data: {
        topBranches: [
          {
            branch_id: "9",
            branch_name: "Qashqadaryo",
            total_orders: "42",
            successful_orders: "31",
            success_rate: "73.81",
          },
        ],
      },
    });

    expect(result.data.topBranches?.[0]).toMatchObject({
      branch_id: "9",
      branch_name: "Qashqadaryo",
      total_orders: 42,
      successful_orders: 31,
      success_rate: 73.81,
    });
  });

  it("normalizes KPI fields", () => {
    const result = normalizeKpiResponse({
      data: {
        average_order_value: "96000",
        average_fulfillment_hours: "24.5",
        on_time_rate: "80",
      },
    });

    expect(result.data).toMatchObject({
      averageOrderValue: 96000,
      averageFulfillmentHours: 24.5,
      onTimeRate: 80,
    });
  });

  it("normalizes branch dashboard cards without requiring every nested object", () => {
    const result = normalizeDashboardResponse({
      data: {
        branch_dashboard: {
          role: "manager",
          todayOrdersCount: "7",
          cards: {
            orders: {
              total: "12",
              onTheRoad: "4",
            },
          },
          visibility: {
            markets: "false",
          },
        },
      },
    });

    expect(result.data.branchDashboard).toMatchObject({
      role: "manager",
      today_orders_count: 7,
      cards: {
        orders: {
          total: 12,
          on_the_road: 4,
        },
        markets: [],
        packages: null,
        couriers: null,
      },
      visibility: {
        markets: false,
      },
    });
  });

  it("normalizes revenue chart and finance numeric strings", () => {
    const result = normalizeRevenueResponse({
      data: {
        chart: {
          labels: ["2026-06-10"],
          values: ["150000"],
        },
        finance: {
          current_situation: "90000",
          main: { balance: "120000" },
          markets: { markets_total_balance: "20000" },
          couriers: { couriers_total_balanse: "10000" },
        },
      },
    });

    expect(result.data.chart).toEqual({
      labels: ["2026-06-10"],
      values: [150000],
    });
    expect(result.data.finance).toMatchObject({
      currentSituation: 90000,
      main: { balance: 120000 },
      markets: { marketsTotalBalans: 20000 },
      couriers: { couriersTotalBalanse: 10000 },
    });
  });
});
