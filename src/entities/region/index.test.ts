import { describe, expect, it } from "vitest";
import {
  mergeRegionDistrictStats,
  normalizeDistrictCatalog,
  normalizeRegionDetailStats,
  normalizeRegionItem,
} from "./index";

describe("region statistics adapters", () => {
  it("normalizes nested region statistics", () => {
    expect(
      normalizeRegionItem({
        id: 14,
        name: "Namangan",
        stats: {
          total_orders: 8088,
          delivered_orders: 5054,
          cancelled_orders: 3034,
          pending_orders: 458,
          total_revenue: 166491818,
          success_rate: 62,
        },
      }),
    ).toMatchObject({
      id: "14",
      ordersCount: 8088,
      deliveredOrders: 5054,
      cancelledOrders: 3034,
      pendingOrders: 458,
      totalRevenue: 166491818,
      successRate: 62,
    });
  });

  it("normalizes district aliases and derives aggregate summary", () => {
    const result = normalizeRegionDetailStats({
      data: {
        region: { id: 14, name: "Namangan" },
        districts: [
          {
            id: 1,
            name: "Chust tumani",
            stats: {
              total_orders: 657,
              delivered: 370,
              cancelled: 257,
              waiting: 30,
              income: 125799000,
            },
          },
        ],
      },
    });

    expect(result.summary).toMatchObject({
      totalOrders: 657,
      totalDelivered: 370,
      totalCancelled: 257,
      pendingOrders: 30,
      totalRevenue: 125799000,
    });
    expect(result.districts[0]).toMatchObject({
      totalOrders: 657,
      deliveredOrders: 370,
      cancelledOrders: 257,
      pendingOrders: 30,
      revenue: 125799000,
    });
  });

  it("accepts a token-scoped detail payload returned by the all endpoint", () => {
    const result = normalizeRegionDetailStats({
      statusCode: 200,
      data: {
        id: "region-14",
        name: "Namangan",
        stats: {
          summary: {
            total_orders: 8088,
            delivered_orders: 5054,
            cancelled_orders: 3034,
            pending_orders: 458,
          },
          districts: [
            {
              id: "district-1",
              name: "Chust tumani",
              total_orders: 657,
            },
          ],
        },
      },
    });

    expect(result.id).toBe("region-14");
    expect(result.name).toBe("Namangan");
    expect(result.summary.totalOrders).toBe(8088);
    expect(result.districts).toHaveLength(1);
  });

  it("keeps every region district and fills missing statistics with zero", () => {
    const catalog = normalizeDistrictCatalog({
      data: {
        id: "12",
        name: "Jizzax",
        districts: [
          { id: "1", name: "Arnasoy tumani", sato_code: "1712201" },
          { id: "2", name: "Baxmal tumani", sato_code: "1712202" },
        ],
      },
    });
    const merged = mergeRegionDistrictStats(null, catalog, {
      id: "12",
      name: "Jizzax",
    });

    expect(merged?.name).toBe("Jizzax");
    expect(merged?.districts).toHaveLength(2);
    expect(merged?.districts[0]).toMatchObject({
      name: "Arnasoy tumani",
      totalOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      pendingOrders: 0,
      revenue: 0,
    });
  });

  it("normalizes a district endpoint that returns its list directly in data", () => {
    expect(
      normalizeDistrictCatalog({
        statusCode: 200,
        data: [
          {
            id: "district-1",
            name: "Arnasoy tumani",
            region_id: "12",
          },
        ],
      }),
    ).toEqual([
      {
        id: "district-1",
        name: "Arnasoy tumani",
        regionId: "12",
      },
    ]);
  });
});
