import { describe, expect, it } from "vitest";
import {
  isCustomerSegmentEmpty,
  isOrderRangeInverted,
  MAX_MIN_ORDERS,
  nextIsoDay,
  parseMinOrders,
  toCustomerSegmentPayload,
} from "./segment";

describe("KM-1 mijozlar segmenti → so'rov tanasi", () => {
  it("bo'sh maydonlar tashlanadi; hech narsa tanlanmasa — bo'sh obyekt", () => {
    expect(toCustomerSegmentPayload({})).toEqual({});
    expect(toCustomerSegmentPayload({ region_id: "", district_id: "  ", market_id: undefined })).toEqual({});
    expect(isCustomerSegmentEmpty({ region_id: "" })).toBe(true);
    expect(isCustomerSegmentEmpty({ market_id: "3" })).toBe(false);
  });

  it("⭐ «Oxirgi buyurtma» oxirgi kuni KIRADI va chegaralar Toshkent yarim tunida: backend `< last_order_to`", () => {
    expect(
      toCustomerSegmentPayload({
        region_id: "1",
        district_id: "12",
        market_id: "3",
        last_order_from: "2026-07-01",
        last_order_to: "2026-09-30",
        min_orders: 2,
      }),
    ).toEqual({
      region_id: "1",
      district_id: "12",
      market_id: "3",
      last_order_from: "2026-07-01T00:00:00+05:00",
      last_order_to: "2026-10-01T00:00:00+05:00",
      min_orders: 2,
    });
  });

  it("sana chegarasi — Toshkent yarim tuni (UTC emas): 01.07 00:30 Toshkent kiradi, 01.10 00:30 kirmaydi", () => {
    const payload = toCustomerSegmentPayload({ last_order_from: "2026-07-01", last_order_to: "2026-09-30" });
    const from = new Date(payload.last_order_from ?? "").getTime();
    const to = new Date(payload.last_order_to ?? "").getTime();
    // 2026-07-01 00:30 Toshkent = 2026-06-30 19:30 UTC — oraliq ichida.
    expect(Date.parse("2026-06-30T19:30:00Z")).toBeGreaterThanOrEqual(from);
    // 2026-10-01 00:30 Toshkent = 2026-09-30 19:30 UTC — oraliqdan tashqarida (`< to`).
    expect(Date.parse("2026-09-30T19:30:00Z")).toBeGreaterThanOrEqual(to);
    // 2026-09-30 23:59 Toshkent — ichida.
    expect(Date.parse("2026-09-30T18:59:00Z")).toBeLessThan(to);
  });

  it("noto'g'ri sana so'rovga ketmaydi", () => {
    expect(toCustomerSegmentPayload({ last_order_from: "01.07.2026", last_order_to: "x" })).toEqual({});
  });

  it("keyingi kun: oy, yil va kabisa chegarasi", () => {
    expect(nextIsoDay("2026-12-31")).toBe("2027-01-01");
    expect(nextIsoDay("2028-02-28")).toBe("2028-02-29");
    expect(nextIsoDay("2026-02-28")).toBe("2026-03-01");
    expect(nextIsoDay("noto'g'ri")).toBe("noto'g'ri");
  });

  it("«Buyurtmalar soni» — faqat butun son ≥ 1 (aks holda filtr yo'q)", () => {
    expect(parseMinOrders("2")).toBe(2);
    expect(parseMinOrders("2.7")).toBe(2);
    expect(parseMinOrders("")).toBeUndefined();
    expect(parseMinOrders("0")).toBeUndefined();
    expect(parseMinOrders("abc")).toBeUndefined();
    expect(toCustomerSegmentPayload({ min_orders: 0 })).toEqual({});
    expect(toCustomerSegmentPayload({ min_orders: 1.5 })).toEqual({});
  });

  it("«Buyurtmalar soni» backend chegarasidan (@Max(1000)) oshmaydi", () => {
    expect(MAX_MIN_ORDERS).toBe(1000);
    expect(parseMinOrders("1000")).toBe(1000);
    expect(parseMinOrders("1500")).toBe(1000);
    expect(toCustomerSegmentPayload({ min_orders: 5000 })).toEqual({ min_orders: 1000 });
  });

  it("«gacha» (KM-2): `max_orders` — butun son ≥ 1; teskari oraliq aniqlanadi", () => {
    expect(toCustomerSegmentPayload({ min_orders: 2, max_orders: 10 })).toEqual({ min_orders: 2, max_orders: 10 });
    expect(toCustomerSegmentPayload({ max_orders: 0 })).toEqual({});
    expect(toCustomerSegmentPayload({ max_orders: 5000 })).toEqual({ max_orders: 1000 });
    expect(isOrderRangeInverted({ min_orders: 10, max_orders: 2 })).toBe(true);
    expect(isOrderRangeInverted({ min_orders: 2, max_orders: 2 })).toBe(false);
    expect(isOrderRangeInverted({ min_orders: 10 })).toBe(false);
  });
});
