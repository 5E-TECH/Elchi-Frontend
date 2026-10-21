import { describe, expect, it } from "vitest";
import type { RegionCourierStats, RegionItem } from "../../../entities/region";
import {
  courierCounts,
  initialsOf,
  logistRegionOptions,
  resolveLogistRegion,
  toLogistCourierRows,
} from "./logistRegionModel";

const region = (id: string, name: string, logistId: string | null, ordersCount: number): RegionItem => ({
  id,
  name,
  districtCount: 3,
  activeCouriers: 1,
  ordersCount,
  deliveredOrders: 0,
  cancelledOrders: 0,
  pendingOrders: 0,
  totalRevenue: 999,
  successRate: 0,
  logistId,
});

const courier = (id: string, extra: Partial<RegionCourierStats> = {}): RegionCourierStats => ({
  id,
  name: `Kuryer ${id}`,
  totalOrders: 0,
  deliveredOrders: 0,
  successRate: 0,
  ...extra,
});

describe("logistRegionOptions", () => {
  it("faqat logistning viloyatlari, buyurtmalar ko'pidan (teng — nom), qisqa nom bilan; pul o'tmaydi", () => {
    const options = logistRegionOptions(
      [
        region("1", "Toshkent shahri", "7", 500),
        region("8", "Qashqadaryo viloyati", "42", 12),
        region("10", "Surxondaryo viloyati", "42", 12),
        region("6", "Samarqand viloyati", "42", 86),
        region("3", "Andijon viloyati", null, 30),
      ],
      42,
    );
    expect(options).toEqual([
      { id: "6", name: "Samarqand viloyati", shortName: "Samarqand", orders: 86 },
      { id: "8", name: "Qashqadaryo viloyati", shortName: "Qashqadaryo", orders: 12 },
      { id: "10", name: "Surxondaryo viloyati", shortName: "Surxondaryo", orders: 12 },
    ]);
  });

  it("logist aniqlanmasa — bo'sh", () => {
    expect(logistRegionOptions([region("6", "Samarqand viloyati", "42", 1)], null)).toEqual([]);
  });
});

describe("resolveLogistRegion", () => {
  const options = [
    { id: "6", name: "Samarqand viloyati", shortName: "Samarqand", orders: 86 },
    { id: "8", name: "Qashqadaryo viloyati", shortName: "Qashqadaryo", orders: 12 },
  ];

  it("ro'yxat hali yo'q — kutish", () => {
    expect(resolveLogistRegion({ options: null, requestedId: "6", fresh: false })).toEqual({ kind: "pending" });
  });

  it("URL'dagi o'z viloyati — eskirgan ro'yxatda ham darhol", () => {
    expect(resolveLogistRegion({ options, requestedId: "8", fresh: false })).toEqual({
      kind: "region",
      option: options[1],
    });
  });

  it("URL'da viloyat yo'q — birinchisi", () => {
    expect(resolveLogistRegion({ options, requestedId: null, fresh: false })).toEqual({
      kind: "region",
      option: options[0],
    });
  });

  it("URL'dagi begona viloyat: eskirgan ro'yxatda — kutish (rad etilmaydi), yangisida — «biriktirilmagan»", () => {
    expect(resolveLogistRegion({ options, requestedId: "1", fresh: false })).toEqual({ kind: "pending" });
    expect(resolveLogistRegion({ options, requestedId: " 1 ", fresh: true })).toEqual({
      kind: "notAssigned",
      requestedId: "1",
    });
  });

  it("viloyat biriktirilmagan — faqat yangi ro'yxat bo'yicha", () => {
    expect(resolveLogistRegion({ options: [], requestedId: null, fresh: false })).toEqual({ kind: "pending" });
    expect(resolveLogistRegion({ options: [], requestedId: null, fresh: true })).toEqual({ kind: "none" });
    expect(resolveLogistRegion({ options: [], requestedId: "6", fresh: true })).toEqual({
      kind: "notAssigned",
      requestedId: "6",
    });
  });
});

describe("toLogistCourierRows / courierCounts", () => {
  const couriers = [
    courier("a", { name: "Ali Valiyev", totalOrders: 4, deliveredOrders: 3, cancelledOrders: 1, districtId: "d1", status: "active", revenue: 5 }),
    courier("b", { name: "Bobur", totalOrders: 9, deliveredOrders: 4, districtId: "d9", status: "inactive" }),
    courier("c", { name: "Hasan", totalOrders: 4, deliveredOrders: 4, phone: "+998905556677", status: "active" }),
    courier("d", { name: "", status: "active" }),
  ];

  it("faqat buyurtmasi borlar, buyurtmalar → sotilgan → ism; tuman nomi; foiz klientda; pul maydoni yo'q", () => {
    const rows = toLogistCourierRows(couriers, [{ id: "d1", name: "Urgut tumani" }]);
    expect(rows.map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(rows[2]).toEqual({
      id: "a",
      name: "Ali Valiyev",
      initials: "AV",
      phone: undefined,
      districtName: "Urgut tumani",
      orders: 4,
      sold: 3,
      cancelled: 1,
      rate: 75,
    });
    expect(rows[0].districtName).toBeUndefined();
    expect(rows[0].rate).toBeCloseTo(44.44, 1);
    expect(Object.keys(rows[0])).not.toContain("revenue");
  });

  it("faol / jami — status bo'yicha; ro'yxat yo'q — null", () => {
    expect(courierCounts(couriers)).toEqual({ active: 3, total: 4 });
    expect(courierCounts(undefined)).toBeNull();
  });

  it("bosh harflar", () => {
    expect(initialsOf("Jasur Tursunov")).toBe("JT");
    expect(initialsOf("  o'tkir   bek  ali ")).toBe("OB");
    expect(initialsOf("")).toBe("?");
  });
});
