import { describe, expect, it } from "vitest";
import { getPaymentSourceTypeLabel } from "./paymentSourceType";

describe("getPaymentSourceTypeLabel", () => {
  const translate = (key: string) =>
    ({
      paymentMarket: "Market to'lovi",
      branchToMainSource: "Filialdan HQga o'tkazma",
    })[key] ?? key;

  it("known source type uchun tarjima qaytaradi", () => {
    expect(getPaymentSourceTypeLabel("market_payment", translate)).toBe(
      "Market to'lovi",
    );
    expect(getPaymentSourceTypeLabel("branch_to_main", translate)).toBe(
      "Filialdan HQga o'tkazma",
    );
  });

  it("unknown source type ni o'qiladigan formatga o'tkazadi", () => {
    expect(getPaymentSourceTypeLabel("new_backend_source")).toBe(
      "New Backend Source",
    );
  });
});
