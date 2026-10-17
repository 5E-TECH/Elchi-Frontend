import { describe, expect, it } from "vitest";
import {
  mergeRegionDistrictStats,
  normalizeDistrictCatalog,
  normalizeMyRegionDistrictStats,
  normalizeRegionDetailStats,
  normalizeRegionItem,
  shortRegionName,
  splitCompactMoney,
  successRateOf,
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

  it("marks courier counts unknown when stats/all sends activeCouriers: null (o2j9uDtT)", () => {
    expect(
      normalizeRegionItem({ id: 1, name: "Andijon", totalOrders: 3, activeCouriers: null }),
    ).toMatchObject({
      activeCouriers: 0,
      couriersKnown: false,
    });
    expect(
      normalizeRegionItem({ id: 1, name: "Andijon", totalOrders: 3, activeCouriers: 4 }),
    ).toMatchObject({
      activeCouriers: 4,
      couriersKnown: true,
    });
  });

  it("adds region couriers from stats/:id with the primary courier and exact rates", () => {
    const result = normalizeRegionDetailStats({
      statusCode: 200,
      data: {
        region: {
          id: "6",
          name: "Samarqand viloyati",
          satoCode: "1718",
          mainCourier: { id: "c2", name: "Shohruh" },
        },
        summary: {
          totalOrders: 21,
          deliveredOrders: 17,
          cancelledOrders: 2,
          pendingOrders: 2,
          totalRevenue: 3_450_000,
        },
        couriers: [
          {
            id: "c1",
            name: "Ilhom",
            phoneNumber: "+998972389014",
            totalOrders: 6,
            deliveredOrders: 5,
            totalRevenue: 1_110_000,
            successRate: 83,
          },
          {
            id: "c2",
            name: "Shohruh",
            phoneNumber: "+998904121805",
            totalOrders: 15,
            deliveredOrders: 12,
            totalRevenue: 2_340_000,
            successRate: 80,
          },
        ],
        districts: [],
      },
    });

    expect(result.satoCode).toBe("1718");
    expect(result.couriers).toHaveLength(2);
    expect(result.couriers?.[0]).toMatchObject({
      id: "c1",
      phone: "+998972389014",
      revenue: 1_110_000,
      isPrimary: false,
    });
    expect(result.couriers?.[0].successRate).toBeCloseTo(83.33, 1);
    expect(result.couriers?.[1]).toMatchObject({ id: "c2", isPrimary: true });
  });

  it("normalizes GET region/my/district-stats (uherIk8r) incl. zero-order districts", () => {
    const result = normalizeMyRegionDistrictStats({
      statusCode: 200,
      data: {
        region: { id: "12", name: "Jizzax viloyati", satoCode: "1708" },
        summary: {
          totalOrders: 9,
          deliveredOrders: 6,
          cancelledOrders: 1,
          pendingOrders: 2,
          totalRevenue: 1_200_000,
          successRate: 67,
          districtsCount: 2,
        },
        districts: [
          {
            id: "1",
            name: "Arnasoy tumani",
            satoCode: "1708201",
            totalOrders: 9,
            deliveredOrders: 6,
            cancelledOrders: 1,
            pendingOrders: 2,
            totalRevenue: 1_200_000,
            couriersCount: 2,
          },
          {
            id: "2",
            name: "Baxmal tumani",
            satoCode: "1708204",
            totalOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            pendingOrders: 0,
            totalRevenue: 0,
            couriersCount: 0,
          },
        ],
      },
    });

    expect(result.region).toEqual({ id: "12", name: "Jizzax viloyati", satoCode: "1708" });
    expect(result.detail?.summary).toMatchObject({
      totalOrders: 9,
      totalDelivered: 6,
      totalCancelled: 1,
      pendingOrders: 2,
      totalRevenue: 1_200_000,
    });
    expect(result.detail?.districts).toHaveLength(2);
    expect(result.detail?.districts[0]).toMatchObject({
      satoCode: "1708201",
      revenue: 1_200_000,
      activeCouriers: 2,
    });
  });

  it("returns region: null when the user has no region assigned", () => {
    expect(
      normalizeMyRegionDistrictStats({
        statusCode: 200,
        message: "Sizga viloyat biriktirilmagan",
        data: { region: null, summary: null, districts: [] },
      }),
    ).toEqual({ region: null, detail: null });
  });

  it("formats helper values for the v2 cards", () => {
    expect(successRateOf(24, 31)).toBeCloseTo(77.42, 1);
    expect(successRateOf(0, 0)).toBe(0);
    expect(splitCompactMoney(48_600_000, "uz")).toEqual({ value: "48,6", unit: "mln so'm" });
    expect(splitCompactMoney(48_600_000, "en")).toEqual({ value: "48.6M", unit: "UZS" });
    expect(shortRegionName("Toshkent shahri")).toBe("Toshkent sh.");
    expect(shortRegionName("Toshkent viloyati")).toBe("Toshkent vil.");
    expect(shortRegionName("Samarqand viloyati")).toBe("Samarqand");
    expect(shortRegionName("Qoraqalpog'iston Respublikasi")).toBe("Qoraqalpog'iston");
  });
});
