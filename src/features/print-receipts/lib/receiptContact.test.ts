import { describe, expect, it } from "vitest";
import {
  cleanReceiptValue,
  formatReceiptPerson,
  formatReceiptPhone,
  getReceiptContactPhone,
  getReceiptContactPhones,
} from "./receiptContact";

describe("receipt contact fields (T7 QPq2C1co: «Muammo bo'lsa» — viloyat logisti)", () => {
  it("prints the region logist from problem_contacts, v2 phone format, no duplicates", () => {
    expect(getReceiptContactPhones({ problem_contacts: [{ phone: "+998901234567" }] })).toEqual([
      "+998 90 123 45 67",
    ]);
    expect(
      getReceiptContactPhones({
        problem_contacts: [{ phone: "+998901234567" }, { phone: "998991981929" }],
      }),
    ).toEqual(["+998 90 123 45 67", "+998 99 198 19 29"]);
    expect(
      getReceiptContactPhone({
        problem_contacts: [{ phone: "901234567" }, { phone: "+998901234567" }],
      }),
    ).toBe("+998 90 123 45 67");
  });

  it("never prints the operator, market or courier phone; empty when no contact is known", () => {
    const legacy = {
      operator_phone: "+998901234567",
      secondary_operator_phone: "+998991981929",
      market: { phone_number: "+998712001122" },
      courier: { phone_number: "905554433" },
    } as Parameters<typeof getReceiptContactPhones>[0];
    expect(getReceiptContactPhones(legacy)).toEqual([]);
    expect(getReceiptContactPhone({ problem_contacts: null })).toBe("");
    expect(getReceiptContactPhone({ problem_contacts: [] })).toBe("");
  });

  it("formats the courier / driver line and omits it when null", () => {
    expect(formatReceiptPerson({ name: "Jasur Tursunov", phone_number: "+998905554433" })).toBe(
      "Jasur Tursunov · +998 90 555 44 33",
    );
    expect(formatReceiptPerson({ name: "Jasur", phone_number: null })).toBe("Jasur");
    expect(formatReceiptPerson(null)).toBe("");
  });

  it("placeholders («-», «—», «–», whitespace, «...», «null») are empty — never printed", () => {
    for (const value of ["-", "—", "–", " - ", "   ", "...", "…", "_", "null", "undefined", "N/A"]) {
      expect(cleanReceiptValue(value), JSON.stringify(value)).toBe("");
      expect(formatReceiptPhone(value), JSON.stringify(value)).toBe("");
    }
    // Raqamsiz matn telefon emas.
    expect(formatReceiptPhone("( )")).toBe("");
    expect(cleanReceiptValue("Baraka-Shop")).toBe("Baraka-Shop");
    expect(formatReceiptPhone(" 998901234567 ")).toBe("+998 90 123 45 67");

    // «-» / «—» raqam emas: faqat haqiqiy raqam qoladi.
    expect(
      getReceiptContactPhones({
        problem_contacts: [{ phone: "-" }, { phone: "—" }, { phone: "+998712001122" }],
      }),
    ).toEqual(["+998 71 200 11 22"]);
    expect(getReceiptContactPhones({ problem_contacts: [{ phone: " - " }] })).toEqual([]);
    expect(formatReceiptPerson({ name: "—", phone_number: "-" })).toBe("");
    expect(formatReceiptPerson({ name: "Jasur", phone_number: "—" })).toBe("Jasur");
  });
});
