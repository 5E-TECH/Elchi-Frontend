import { describe, expect, it } from "vitest";
import { getSellPaymentStatus } from "./sellPayment";

describe("sellPayment (uguUEhin)", () => {
  it("javobdagi data.status — paid / partly_paid; boshqasi null", () => {
    expect(getSellPaymentStatus({ statusCode: 200, data: { status: "paid" } })).toBe("paid");
    expect(getSellPaymentStatus({ data: { status: "partly_paid" } })).toBe("partly_paid");
    expect(getSellPaymentStatus({ data: { status: "sold" } })).toBeNull();
    expect(getSellPaymentStatus({ statusCode: 202, data: { approval_required: true } })).toBeNull();
    expect(getSellPaymentStatus(undefined)).toBeNull();
  });
});
