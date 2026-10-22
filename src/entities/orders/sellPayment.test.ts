import { describe, expect, it } from "vitest";
import { getMarketPaidMax, getSellPaymentStatus, readMarketPaidBase } from "./sellPayment";

describe("sellPayment (uguUEhin)", () => {
  it("javobdagi data.status — paid / partly_paid; boshqasi null", () => {
    expect(getSellPaymentStatus({ statusCode: 200, data: { status: "paid" } })).toBe("paid");
    expect(getSellPaymentStatus({ data: { status: "partly_paid" } })).toBe("partly_paid");
    expect(getSellPaymentStatus({ data: { status: "sold" } })).toBeNull();
    expect(getSellPaymentStatus({ statusCode: 202, data: { approval_required: true } })).toBeNull();
    expect(getSellPaymentStatus(undefined)).toBeNull();
  });

  it("chegara asosi: backend `sale_market_paid_max` ustun, `null` / yo'q bo'lsa `to_be_paid`", () => {
    expect(readMarketPaidBase({ to_be_paid: 0, sale_market_paid_max: 30000 })).toBe(30000);
    expect(getMarketPaidMax(readMarketPaidBase({ to_be_paid: 0, sale_market_paid_max: "30000" }), 10000)).toBe(20000);
    expect(readMarketPaidBase({ to_be_paid: 120000, sale_market_paid_max: null })).toBe(120000);
    expect(readMarketPaidBase({ to_be_paid: 120000 })).toBe(120000);
  });

  it("maksimum: to_be_paid − extraCost; noma'lum bo'lsa null, manfiy emas", () => {
    expect(getMarketPaidMax(120000, 20000)).toBe(100000);
    expect(getMarketPaidMax("50000", 0)).toBe(50000);
    expect(getMarketPaidMax(10000, 30000)).toBe(0);
    expect(getMarketPaidMax(null, 0)).toBeNull();
    expect(getMarketPaidMax(undefined, 0)).toBeNull();
    expect(getMarketPaidMax("abc", 0)).toBeNull();
  });
});
