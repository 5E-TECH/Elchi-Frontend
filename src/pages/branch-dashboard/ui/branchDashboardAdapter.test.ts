import { describe, expect, it } from "vitest";
import { normalizeDashboardResponse } from "../../../entities/dashboard";
import { adaptBranchDashboard } from "./branchDashboardAdapter";

describe("branch dashboard adapter", () => {
  it("does not crash when backend omits cards", () => {
    expect(
      adaptBranchDashboard({
        role: "manager",
        today_orders_count: 3,
        week_orders_count: 10,
        active_batches_count: 2,
        couriers_count: 4,
      }),
    ).toMatchObject({
      role: "MANAGER",
      todayOrdersCount: 3,
      orderSummary: {
        total: 0,
      },
      couriers: {
        total: 4,
      },
    });
  });

  it("uses the authenticated role when backend omits role", () => {
    const result = adaptBranchDashboard(null, "manager");

    expect(result.role).toBe("MANAGER");
    expect(result.visibility.markets).toBe(true);
    expect(result.visibility.couriers).toBe(true);
  });

  it("falls back to filtered order summary when branch cards are empty", () => {
    const result = adaptBranchDashboard(
      {
        role: "manager",
        today_orders_count: 0,
        week_orders_count: 0,
        active_batches_count: 0,
        couriers_count: 0,
        cards: {
          orders: {
            total: 0,
            new: 0,
            on_the_road: 0,
            delivered: 0,
            returned: 0,
          },
          markets: [],
          packages: null,
          couriers: null,
        },
      },
      "manager",
      {
        acceptedCount: 7,
        soldAndPaid: 3,
        cancelled: 1,
        profit: 0,
        totalRevenue: 0,
      },
    );

    expect(result.todayOrdersCount).toBe(7);
    expect(result.orderSummary).toMatchObject({
      total: 7,
      onTheRoad: 3,
      delivered: 3,
      returned: 1,
    });
  });

  it("keeps selected total independent from sold and cancelled outcome counts", () => {
    const result = adaptBranchDashboard(
      {
        role: "manager",
        today_orders_count: 0,
        week_orders_count: 0,
        active_batches_count: 0,
        couriers_count: 1,
        cards: {
          orders: {
            total: 0,
            new: 0,
            on_the_road: 0,
            delivered: 0,
            returned: 0,
          },
          markets: [],
          packages: null,
          couriers: null,
        },
      },
      "manager",
      {
        acceptedCount: 2,
        soldAndPaid: 2,
        cancelled: 2,
        profit: 0,
        totalRevenue: 0,
      },
    );

    expect(result.orderSummary).toMatchObject({
      total: 2,
      onTheRoad: 0,
      delivered: 2,
      returned: 2,
    });
  });
  it("treats zero filtered order summary as authoritative over branch cards", () => {
    const result = adaptBranchDashboard(
      {
        role: "manager",
        today_orders_count: 0,
        week_orders_count: 0,
        active_batches_count: 0,
        couriers_count: 1,
        cards: {
          orders: {
            total: 0,
            new: 0,
            on_the_road: 0,
            delivered: 0,
            returned: 1,
          },
          markets: [],
          packages: null,
          couriers: null,
        },
      },
      "manager",
      {
        acceptedCount: 0,
        total: 0,
        totalOrders: 0,
        ordersCount: 0,
        soldAndPaid: 0,
        cancelled: 0,
        profit: 0,
        totalRevenue: 0,
      },
      true,
    );

    expect(result.orderSummary).toMatchObject({
      total: 0,
      onTheRoad: 0,
      delivered: 0,
      returned: 0,
    });
  });

  it("labels a market without a name as 'Market N'", () => {
    const result = adaptBranchDashboard(
      {
        role: "manager",
        today_orders_count: 0,
        week_orders_count: 0,
        active_batches_count: 0,
        couriers_count: 0,
        cards: {
          orders: null,
          markets: [{ id: "201", name: "", orders: 5, amount: 750000 }],
          packages: null,
          couriers: null,
        },
      },
      "manager",
    );

    expect(result.markets[0]).toEqual({ id: "201", name: "Market 1", orders: 5, amount: 750000 });
  });

  it("keeps a market name as is", () => {
    const result = adaptBranchDashboard(
      {
        role: "manager",
        today_orders_count: 0,
        week_orders_count: 0,
        active_batches_count: 0,
        couriers_count: 0,
        cards: {
          orders: null,
          markets: [{ id: "201", name: "Yandex", orders: 5, amount: 750000 }],
          packages: null,
          couriers: null,
        },
      },
      "manager",
    );

    expect(result.markets[0]).toEqual({ id: "201", name: "Yandex", orders: 5, amount: 750000 });
  });

  it("shows the real backend payload on the manager cards (cancelled, market name, branch couriers)", () => {
    const normalized = normalizeDashboardResponse({
      data: {
        branchDashboard: {
          role: "MANAGER",
          today_orders_count: 3,
          week_orders_count: 4,
          active_batches_count: 1,
          couriers_count: 3,
          cards: {
            orders: { total: 8, new: 1, on_the_road: 2, delivered: 6, returned: 0, cancelled: 2 },
            markets: [
              { market_id: "201", market_name: "Yandex", orders_count: 5, total_price: 750000 },
              // identity javob bermagan — nom yo'q.
              { market_id: "202", market_name: null, orders_count: 1, total_price: 90000 },
            ],
            packages: { on_the_way: 1, waiting_for_acceptance: 0 },
            couriers: { branch_couriers: 3, active_today: 1 },
          },
          visibility: { orders: true, markets: true, packages: true, couriers: true },
        },
      },
    });

    const result = adaptBranchDashboard(normalized.data.branchDashboard, "manager");

    expect(result.orderSummary).toEqual({
      total: 8,
      new: 1,
      onTheRoad: 2,
      delivered: 6,
      returned: 2,
    });
    expect(result.markets).toEqual([
      { id: "201", name: "Yandex", orders: 5, amount: 750000 },
      { id: "202", name: "Market 2", orders: 1, amount: 90000 },
    ]);
    expect(result.couriers).toEqual({ total: 3, active: 1 });
  });
});
