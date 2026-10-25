import { describe, expect, it } from "vitest";
import { formatOrderRef, orderIdFromSearch, orderNumberOf, toOrderSearchTerm } from "./orderNumber";

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

describe("qidiruv — «EL-…» faqat ID bo'yicha (ega qarori 2026-10-25, FoCaUF10)", () => {
  it("ro'yxatga kanonik «EL-N» o'zgarmay ketadi (backend uni id'ga aylantiradi, mijoz qidiruvisiz)", () => {
    expect(toOrderSearchTerm("EL-100081")).toBe("EL-100081");
    expect(toOrderSearchTerm(" #EL-1351138 ")).toBe("EL-1351138");
    expect(toOrderSearchTerm("№EL-100081")).toBe("EL-100081");
    expect(toOrderSearchTerm("el100081")).toBe("EL-100081");
    expect(toOrderSearchTerm("el 100081")).toBe("EL-100081");
  });

  it("qadaladigan aniq buyurtma uchun ichki id (`GET orders/:id`)", () => {
    expect(orderIdFromSearch("EL-100081")).toBe("81");
    expect(orderIdFromSearch(" #EL-1351138 ")).toBe("1251138");
    expect(orderIdFromSearch("№EL-100081")).toBe("81");
    expect(orderIdFromSearch("Ali")).toBeNull();
    expect(orderIdFromSearch("EL-100000")).toBeNull();
  });

  it("boshqa matn o'zgarmaydi: ism, telefon, oddiy raqam, noto'g'ri raqam", () => {
    expect(toOrderSearchTerm("Ali")).toBe("Ali");
    expect(toOrderSearchTerm("901234567")).toBe("901234567");
    expect(toOrderSearchTerm("1251138")).toBe("1251138");
    expect(toOrderSearchTerm("EL-100000")).toBe("EL-100000");
    expect(toOrderSearchTerm("EL-12")).toBe("EL-12");
  });
});
