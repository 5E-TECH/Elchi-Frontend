import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import {
  getCashboxTypeLabel,
  getPaymentMethodLabel,
  getPaymentSourceTitle,
  getPaymentSourceTypeLabel,
  getViewerOperationType,
} from "./paymentSourceType";

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


describe("v2 kassa tarixi yorliqlari (maket matnlari)", () => {
  const t = (key: string) => i18n.t(key, { ns: "payments", lng: "uz" });

  it("getPaymentSourceTitle: ko'ruvchiga qarab maketdagi nom", () => {
    expect(getPaymentSourceTitle("courier_payment", t, { role: "superadmin", cashboxType: "main" })).toBe("Kuryer to'lovi");
    expect(getPaymentSourceTitle("courier_payment", t, { role: "admin", cashboxType: "couriers" })).toBe("Kuryer to'lovi");
    // Filial kassasidagi kuryer o'tkazmasi — superadminda ham «Kuryerdan filialga o'tkazma» (cash-detail-branch).
    expect(getPaymentSourceTitle("courier_payment", t, { role: "superadmin", cashboxType: "branch" })).toBe(
      "Kuryerdan filialga o'tkazma",
    );
    expect(getPaymentSourceTitle("courier_payment", t, { role: "manager" })).toBe("Kuryerdan filialga o'tkazma");
    expect(getPaymentSourceTitle("courier_payment", t, { role: "courier" })).toBe("Kuryerdan filialga o'tkazma");
    expect(getPaymentSourceTitle("market_payment", t, { role: "market" })).toBe("HQ'dan marketga o'tkazma");
    expect(getPaymentSourceTitle("market_payment", t, { role: "superadmin" })).toBe("Market to'lovi");
    expect(getPaymentSourceTitle("branch_to_main", t)).toBe("Filialdan HQ'ga o'tkazma");
    expect(getPaymentSourceTitle("correction", t)).toBe("Tuzatish");
    expect(getPaymentSourceTitle("sell", t)).toBe("Sotuv");
    expect(getPaymentSourceTitle("new_backend_source", t)).toBe("New Backend Source");
    expect(getPaymentSourceTitle("", t)).toBe("—");
    expect(getPaymentSourceTitle(null, t)).toBe("—");
  });

  it("getPaymentMethodLabel: naqd, o'tkazma, marketga o'tkazma, payme, noma'lum", () => {
    expect(getPaymentMethodLabel("cash", t)).toBe("Naqd");
    expect(getPaymentMethodLabel("click", t)).toBe("O'tkazma");
    expect(getPaymentMethodLabel("card", t)).toBe("O'tkazma");
    expect(getPaymentMethodLabel("transfer", t)).toBe("O'tkazma");
    expect(getPaymentMethodLabel("click_to_market", t)).toBe("Marketga o'tkazma");
    expect(getPaymentMethodLabel("payme", t)).toBe("Payme");
    expect(getPaymentMethodLabel("uzcard", t)).toBe("uzcard");
    expect(getPaymentMethodLabel(undefined, t)).toBe("—");
  });

  it("getCashboxTypeLabel: kassa turlari; menejer uchun filial kassasi — «Asosiy kassa»", () => {
    expect(getCashboxTypeLabel("main", t)).toBe("Asosiy kassa");
    expect(getCashboxTypeLabel("couriers", t)).toBe("Kuryer kassasi");
    expect(getCashboxTypeLabel("courier", t)).toBe("Kuryer kassasi");
    expect(getCashboxTypeLabel("markets", t)).toBe("Market kassasi");
    expect(getCashboxTypeLabel("branch", t)).toBe("Filial kassasi");
    expect(getCashboxTypeLabel("branch", t, "manager")).toBe("Asosiy kassa");
    expect(getCashboxTypeLabel("", t)).toBe("—");
  });

  it("getViewerOperationType (D2): market o'z kassasida HQ → market o'tkazmasini chiqim ko'radi", () => {
    expect(getViewerOperationType({ operation_type: "income", source_type: "market_payment" }, "market")).toBe("expense");
    expect(getViewerOperationType({ operation_type: "expense", source_type: "market_payment" }, "market")).toBe("expense");
    expect(getViewerOperationType({ operation_type: "income", source_type: "market_payment" }, "superadmin")).toBe("income");
    expect(getViewerOperationType({ operation_type: "expense", source_type: "market_payment" }, "admin")).toBe("expense");
    expect(getViewerOperationType({ operation_type: "income", source_type: "sell" }, "market")).toBe("income");
    expect(getViewerOperationType({ operation_type: "weird" }, "market")).toBeNull();
    expect(getViewerOperationType(null, "market")).toBeNull();
  });
});
