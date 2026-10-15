import { describe, expect, it } from "vitest";
import { getMarketPaidMax, getSellPaymentStatus } from "./sellPayment";

describe("sellPayment (uguUEhin)", () => {
  it("javobdagi data.status — paid / partly_paid; boshqasi null", () => {
    expect(getSellPaymentStatus({ statusCode: 200, data: { status: "paid" } })).toBe("paid");
    expect(getSellPaymentStatus({ data: { status: "partly_paid" } })).toBe("partly_paid");
    expect(getSellPaymentStatus({ data: { status: "sold" } })).toBeNull();
    expect(getSellPaymentStatus({ statusCode: 202, data: { approval_required: true } })).toBeNull();
    expect(getSellPaymentStatus(undefined)).toBeNull();
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
