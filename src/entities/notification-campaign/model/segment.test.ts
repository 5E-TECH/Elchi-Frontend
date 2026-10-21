import { describe, expect, it } from "vitest";
import { isCustomerSegmentEmpty, nextIsoDay, parseMinOrders, toCustomerSegmentPayload } from "./segment";

describe("KM-1 mijozlar segmenti → so'rov tanasi", () => {
  it("bo'sh maydonlar tashlanadi; hech narsa tanlanmasa — bo'sh obyekt", () => {
    expect(toCustomerSegmentPayload({})).toEqual({});
    expect(toCustomerSegmentPayload({ region_id: "", district_id: "  ", market_id: undefined })).toEqual({});
    expect(isCustomerSegmentEmpty({ region_id: "" })).toBe(true);
    expect(isCustomerSegmentEmpty({ market_id: "3" })).toBe(false);
  });

  it("⭐ «Oxirgi buyurtma» oxirgi kuni KIRADI: backend `< last_order_to` — keyingi kun yuboriladi", () => {
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
      last_order_from: "2026-07-01",
      last_order_to: "2026-10-01",
      min_orders: 2,
    });
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
});
