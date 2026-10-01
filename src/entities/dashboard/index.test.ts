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
    expect(result.data.myStat).toEqual({
      totalOrders: 38,
      soldOrders: 7,
      canceledOrders: 0,
      profit: 19060000,
      successRate: 18.42,
    });
  });

  it("normalizes a market's operator leaderboard", () => {
    const result = normalizeDashboardResponse({
      data: {
        topOperators: [
          {
            operator_id: "operator-1",
            operator_name: "Operator Ali",
            total_orders: "20",
            successful_orders: "16",
            success_rate: "80",
          },
        ],
      },
    });

    expect(result.data.topOperators).toEqual([
      {
        operator_id: "operator-1",
        operator_name: "Operator Ali",
        total_orders: 20,
        successful_orders: 16,
        success_rate: 80,
      },
    ]);
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

  it("normalizes the full per-market / per-courier stats (market_stats / courier_stats shape)", () => {
    const result = normalizeDashboardResponse({
      statusCode: 200,
      message: "Dashboard infos",
      data: {
        markets: [
          { market: { id: "3", name: "Yandex" }, totalOrders: "66", soldOrders: "16", sellingRate: "24.24" },
        ],
        couriers: [
          { courier: { id: "75", name: "Surxon courier 1" }, totalOrders: 3, soldOrders: 3, successRate: 100 },
        ],
      },
    });

    expect(result.data.markets).toEqual([
      { market_id: "3", market_name: "Yandex", total_orders: 66, successful_orders: 16, success_rate: 24.24 },
    ]);
    expect(result.data.couriers).toEqual([
      { courier_id: "75", courier_name: "Surxon courier 1", total_orders: 3, successful_orders: 3, success_rate: 100 },
    ]);
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

  // Haqiqiy backend javobi: GET /analytics/dashboard → data.branchDashboard
  // (branch-service getBranchStats). Kalitlar: orders.cancelled,
  // markets[].market_id/market_name/orders_count/total_price,
  // couriers.branch_couriers.
  const realBranchDashboard = {
    role: "MANAGER",
    today_orders_count: 3,
    week_orders_count: 4,
    active_batches_count: 1,
    couriers_count: 3,
    cards: {
      orders: { total: 8, new: 1, on_the_road: 2, delivered: 6, returned: 0, cancelled: 2 },
      markets: [
        {
          market_id: "201",
          market_name: "Yandex",
          orders_count: 5,
          delivered_count: 3,
          total_price: 750000,
        },
      ],
      packages: { on_the_way: 1, waiting_for_acceptance: 0 },
      couriers: { branch_couriers: 3, active_today: 1 },
    },
    visibility: { orders: true, markets: true, packages: true, couriers: true },
  };

  it("maps the real backend branch dashboard payload", () => {
    const result = normalizeDashboardResponse({
      data: { branchDashboard: realBranchDashboard },
    });

    const cards = result.data.branchDashboard?.cards;
    expect(cards?.orders).toEqual({
      total: 8,
      new: 1,
      on_the_road: 2,
      delivered: 6,
      returned: 2,
    });
    expect(cards?.markets).toEqual([{ id: "201", name: "Yandex", orders: 5, amount: 750000 }]);
    expect(cards?.couriers).toEqual({ total: 3, active: 1 });
  });

  it("maps 'Bekor qilingan' from cancelled even when it is zero", () => {
    const result = normalizeDashboardResponse({
      data: {
        branchDashboard: {
          ...realBranchDashboard,
          cards: {
            ...realBranchDashboard.cards,
            orders: { total: 5, delivered: 2, returned: 3, cancelled: 0 },
          },
        },
      },
    });

    expect(result.data.branchDashboard?.cards?.orders?.returned).toBe(0);
  });

  it("falls back to returned for a legacy backend without cancelled", () => {
    const result = normalizeDashboardResponse({
      data: { branchDashboard: { cards: { orders: { total: 9, returned: 4 } } } },
    });

    expect(result.data.branchDashboard?.cards?.orders?.returned).toBe(4);
  });

  it("falls back to couriers_count when branch_couriers is missing", () => {
    const result = normalizeDashboardResponse({
      data: {
        branchDashboard: {
          couriers_count: 5,
          cards: { couriers: { active_today: 1 } },
        },
      },
    });

    expect(result.data.branchDashboard?.cards?.couriers).toEqual({ total: 5, active: 1 });
  });

  it("leaves the market name empty when identity returned no name and keeps legacy market keys", () => {
    const result = normalizeDashboardResponse({
      data: {
        branchDashboard: {
          cards: {
            markets: [
              { market_id: "201", market_name: null, orders_count: "5", total_price: "750000" },
              { id: 7, name: "Kimdur", orders: 2, amount: 120000 },
            ],
          },
        },
      },
    });

    expect(result.data.branchDashboard?.cards?.markets).toEqual([
      { id: "201", name: "", orders: 5, amount: 750000 },
      { id: "7", name: "Kimdur", orders: 2, amount: 120000 },
    ]);
  });

  it("normalizes revenue chart and finance numeric strings", () => {
    const result = normalizeRevenueResponse({
      data: {
        summary: {
          totalRevenue: "150000",
          totalOrders: "3",
          avgRevenue: "150000",
        },
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
    expect(result.data.summary).toEqual({
      totalRevenue: 150000,
      totalOrders: 3,
      avgRevenue: 150000,
    });
    expect(result.data.finance).toMatchObject({
      currentSituation: 90000,
      main: { balance: 120000 },
      markets: { marketsTotalBalans: 20000 },
      couriers: { couriersTotalBalanse: 10000 },
    });
  });
});
