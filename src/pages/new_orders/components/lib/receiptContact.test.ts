import { describe, expect, it } from "vitest";
import { formatReceiptPerson, getReceiptContactPhone } from "./receiptContact";

describe("1mOjtOVC: receipt contact fields", () => {
  it("prefers operator_phone (+ secondary operator) over the market phone", () => {
    expect(
      getReceiptContactPhone({
        operator_phone: "+998901234567",
        secondary_operator_phone: "998991981929",
        market: { phone_number: "+998712001122" },
      }),
    ).toBe("+998 (90) 123-45-67, +998 (99) 198-19-29");
    expect(getReceiptContactPhone({ secondary_operator_phone: "991981929" })).toBe(
      "+998 (99) 198-19-29",
    );
    expect(
      getReceiptContactPhone({ operator_phone: "901234567", secondary_operator_phone: "+998901234567" }),
    ).toBe("+998 (90) 123-45-67");
  });

  it("falls back to market phone, then logist / courier; empty when nothing is known", () => {
    expect(
      getReceiptContactPhone({ operator_phone: null, market: { phone_number: "+998712001122" } }),
    ).toBe("+998 (71) 200-11-22");
    expect(getReceiptContactPhone({ courier: { phone_number: "905554433" } })).toBe(
      "+998 (90) 555-44-33",
    );
    expect(getReceiptContactPhone({ operator_phone: " ", market: null })).toBe("");
  });

  it("formats the courier / driver line and omits it when null", () => {
    expect(formatReceiptPerson({ name: "Jasur Tursunov", phone_number: "+998905554433" })).toBe(
      "Jasur Tursunov · +998 (90) 555-44-33",
    );
    expect(formatReceiptPerson({ name: "Jasur", phone_number: null })).toBe("Jasur");
    expect(formatReceiptPerson(null)).toBe("");
  });
});
