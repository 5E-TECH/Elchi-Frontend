import { describe, expect, it } from "vitest";
import {
  CARD_FILTER_NONE,
  EMPTY_METHOD_CARD_FILTERS,
  PAYMENT_METHOD_FILTER_VALUES,
  methodCardParams,
  readCardFilter,
  readPaymentMethodFilter,
} from "./historyMethodCardFilter";

/** KRN902pg — URL'dagi «To'lov usuli» / «Karta» qiymatlari: noto'g'risi so'rovga ketmaydi (backend 400 berardi). */
describe("KRN902pg — historyMethodCardFilter", () => {
  it("«To'lov usuli»: faqat backend qabul qiladigan qiymatlar", () => {
    expect(PAYMENT_METHOD_FILTER_VALUES).toEqual(["cash", "click", "click_to_market", "none"]);
    for (const value of PAYMENT_METHOD_FILTER_VALUES) expect(readPaymentMethodFilter(value)).toBe(value);
    for (const bad of ["card", "CASH", "cash,click", " cash", "", null, undefined]) {
      expect(readPaymentMethodFilter(bad)).toBe("");
    }
  });

  it("«Karta»: karta ID si (1–18 raqam) yoki `none`", () => {
    expect(readCardFilter("3")).toBe("3");
    expect(readCardFilter("123456789012345678")).toBe("123456789012345678");
    expect(readCardFilter(CARD_FILTER_NONE)).toBe("none");
    for (const bad of ["abc", "-1", "3,4", "1".repeat(19), "", null, undefined]) {
      expect(readCardFilter(bad)).toBe("");
    }
  });

  it("so'rov parametrlari — faqat ko'rinadigan va to'ldirilgan filtrlar", () => {
    const filters = { payment_method: "cash", card_id: "3" };
    expect(methodCardParams(filters, { method: true, card: true })).toEqual({ payment_method: "cash", card_id: "3" });
    // 63HO6cBU: usul ko'rinmaydigan joyda (kuryer — filial kassasi) filtr ham ketmaydi; kartasiz doira — card_id yo'q.
    expect(methodCardParams(filters, { method: false, card: true })).toEqual({ card_id: "3" });
    expect(methodCardParams(filters, { method: true, card: false })).toEqual({ payment_method: "cash" });
    expect(methodCardParams(EMPTY_METHOD_CARD_FILTERS, { method: true, card: true })).toEqual({});
  });
});
