import { describe, expect, it } from "vitest";
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
});
