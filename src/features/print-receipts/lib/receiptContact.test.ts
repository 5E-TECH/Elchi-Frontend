import { describe, expect, it } from "vitest";
import {
  formatReceiptPerson,
  getReceiptContactPhone,
  getReceiptContactPhones,
} from "./receiptContact";

describe("receipt contact fields (1mOjtOVC, HJ5sLHiz: maket tizim-receipts 10-band)", () => {
  it("prefers operator_phone (+ secondary operator) over the market phone, v2 phone format, no duplicates", () => {
    expect(
      getReceiptContactPhones({
        operator_phone: "+998901234567",
        secondary_operator_phone: "998991981929",
        market: { phone_number: "+998712001122" },
      }),
    ).toEqual(["+998 90 123 45 67", "+998 99 198 19 29"]);
    expect(getReceiptContactPhone({ secondary_operator_phone: "991981929" })).toBe(
      "+998 99 198 19 29",
    );
    expect(
      getReceiptContactPhone({
        operator_phone: "901234567",
        secondary_operator_phone: "+998901234567",
      }),
    ).toBe("+998 90 123 45 67");
  });

  it("falls back to the market phone only (no logist / courier); empty when nothing is known", () => {
    expect(
      getReceiptContactPhone({ operator_phone: null, market: { phone_number: "+998712001122" } }),
    ).toBe("+998 71 200 11 22");
    // Eski zaxira (logist / kuryer) olib tashlangan: maketda «Logist» qatori yo'q.
    const legacy = { courier: { phone_number: "905554433" } } as Parameters<
      typeof getReceiptContactPhones
    >[0];
    expect(getReceiptContactPhones(legacy)).toEqual([]);
    expect(getReceiptContactPhone({ operator_phone: " ", market: null })).toBe("");
  });

  it("formats the courier / driver line and omits it when null", () => {
    expect(formatReceiptPerson({ name: "Jasur Tursunov", phone_number: "+998905554433" })).toBe(
      "Jasur Tursunov · +998 90 555 44 33",
    );
    expect(formatReceiptPerson({ name: "Jasur", phone_number: null })).toBe("Jasur");
    expect(formatReceiptPerson(null)).toBe("");
  });
});
