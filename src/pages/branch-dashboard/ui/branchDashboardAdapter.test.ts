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
});
