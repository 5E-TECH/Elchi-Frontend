import { describe, expect, it } from "vitest";
import { formatOrderRef, orderNumberOf, toOrderSearchTerm } from "./orderNumber";

describe("buyurtma raqami — order_number (rwAy8Qyk)", () => {
  it("order_number bor — «№EL-100081», nusxa «EL-100081»", () => {
    expect(formatOrderRef({ id: "81", order_number: "EL-100081" })).toBe("№EL-100081");
    expect(orderNumberOf({ id: "81", order_number: "EL-100081" })).toBe("EL-100081");
  });

  it("oldidagi «#» / «№» va bo'shliq ikki marta qo'shilmaydi", () => {
    expect(formatOrderRef({ id: "81", order_number: "#EL-100081" })).toBe("№EL-100081");
    expect(formatOrderRef({ id: "81", order_number: " № EL-100081 " })).toBe("№EL-100081");
  });

  it("order_number yo'q, bo'sh yoki matn emas — zaxira ichki id", () => {
    expect(formatOrderRef({ id: "81" })).toBe("№81");
    expect(formatOrderRef({ id: 81, order_number: "" })).toBe("№81");
    expect(formatOrderRef({ id: "81", order_number: null })).toBe("№81");
    expect(formatOrderRef({ id: "81", order_number: 100081 })).toBe("№81");
  });

  it("buyurtma hali yuklanmagan — URL'dagi id", () => {
    expect(formatOrderRef(null, "1251138")).toBe("№1251138");
    expect(orderNumberOf(undefined, "1251138")).toBe("1251138");
  });
});

describe("qidiruv — ko'rinadigan raqam ichki id'ga (rwAy8Qyk, FoCaUF10 gacha)", () => {
  it("«EL-100081», «#EL-100081», «№EL-100081», «el100081» — «81»", () => {
    expect(toOrderSearchTerm("EL-100081")).toBe("81");
    expect(toOrderSearchTerm(" #EL-1351138 ")).toBe("1251138");
    expect(toOrderSearchTerm("№EL-100081")).toBe("81");
    expect(toOrderSearchTerm("el100081")).toBe("81");
  });

  it("boshqa matn o'zgarmaydi: ism, telefon, oddiy raqam, noto'g'ri raqam", () => {
    expect(toOrderSearchTerm("Ali")).toBe("Ali");
    expect(toOrderSearchTerm("901234567")).toBe("901234567");
    expect(toOrderSearchTerm("1251138")).toBe("1251138");
    expect(toOrderSearchTerm("EL-100000")).toBe("EL-100000");
    expect(toOrderSearchTerm("EL-12")).toBe("EL-12");
  });
});
