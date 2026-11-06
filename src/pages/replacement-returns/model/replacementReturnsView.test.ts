import { describe, expect, it } from "vitest";
import {
  buildReplacementReturnsParams,
  readReplacementFilters,
  replacementItemsText,
  replacementOrderHref,
  stateOrDefault,
  writeReplacementFilters,
} from "./replacementReturnsView";

describe("almashtirish qaytarmalari — URL filtrlari va so'rov (lQjt6sKP)", () => {
  it("URL → filtrlar: noma'lum holat va raqam bo'lmagan market e'tiborsiz", () => {
    expect(readReplacementFilters(new URLSearchParams("state=old_collected&market=37"))).toEqual({
      state: "old_collected",
      market: "37",
    });
    expect(readReplacementFilters(new URLSearchParams("state=pending&market=abc"))).toEqual({ state: "", market: "" });
    expect(readReplacementFilters(new URLSearchParams(""))).toEqual({ state: "", market: "" });
  });

  it("filtr yozilganda sahifa 1 ga qaytadi, `limit` qoladi; bo'sh qiymat kalitni o'chiradi", () => {
    const next = writeReplacementFilters(new URLSearchParams("page=4&limit=50&market=37"), {
      state: "awaiting_old_pickup",
    });
    expect(next.toString()).toBe("limit=50&market=37&state=awaiting_old_pickup");

    const cleared = writeReplacementFilters(next, { state: "", market: "" });
    expect(cleared.toString()).toBe("limit=50");
  });

  it("`market_id` faqat filtrli rolda (superadmin, admin) ketadi; bo'sh holat yuborilmaydi", () => {
    const filters = { state: "old_collected" as const, market: "37" };
    expect(buildReplacementReturnsParams({ page: 2, limit: 20, filters, canFilterMarket: true })).toEqual({
      page: 2,
      limit: 20,
      state: "old_collected",
      market_id: "37",
    });
    expect(buildReplacementReturnsParams({ page: 1, limit: 20, filters, canFilterMarket: false })).toEqual({
      page: 1,
      limit: 20,
      state: "old_collected",
    });
    expect(
      buildReplacementReturnsParams({ page: 1, limit: 10, filters: { state: "", market: "" }, canFilterMarket: true }),
    ).toEqual({ page: 1, limit: 10 });
  });

  it("mahsulotlar matni nomsiz qatorni tashlaydi; holat yo'q — «kutilmoqda»; havola — tafsilot", () => {
    const line = (name: string, quantity: number) => `${name} × ${quantity}`;
    expect(
      replacementItemsText(
        [
          { product_id: "1", product_name: "Telefon", quantity: 1 },
          { product_id: null, product_name: null, quantity: 3 },
          { product_id: "2", product_name: "G'ilof", quantity: 2 },
        ],
        line,
      ),
    ).toBe("Telefon × 1, G'ilof × 2");
    expect(stateOrDefault(null)).toBe("awaiting_old_pickup");
    expect(stateOrDefault("old_returned")).toBe("old_returned");
    expect(replacementOrderHref("81")).toBe("/orders/edit/81");
  });
});
