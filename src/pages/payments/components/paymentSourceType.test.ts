import { describe, expect, it } from "vitest";
import { getPaymentSourceTypeLabel } from "./paymentSourceType";

describe("getPaymentSourceTypeLabel", () => {
  const translate = (key: string) =>
    ({
      courierToBranchTransfer: "Kuryerdan filialga o'tkazma",
      hqToMarketTransfer: "HQdan marketga o'tkazma",
      branchToMainSource: "Filialdan HQga o'tkazma",
    })[key] ?? key;

  it("known source type uchun tarjima qaytaradi", () => {
    expect(getPaymentSourceTypeLabel("courier_payment", translate)).toBe(
      "Kuryerdan filialga o'tkazma",
    );
    expect(getPaymentSourceTypeLabel("market_payment", translate)).toBe(
      "HQdan marketga o'tkazma",
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
