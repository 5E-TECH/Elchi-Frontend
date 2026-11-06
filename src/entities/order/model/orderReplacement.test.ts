import { describe, expect, it } from "vitest";
import { formatReplacementOrderRef, readOrderReplacement } from "./orderReplacement";

/** lQjt6sKP: almashtirish maydonlari — darvoza sharti backend `assertReplacementSaleAllowed` bilan aynan bir xil. */
describe("readOrderReplacement", () => {
  it("⭐ yangi buyurtma, eski mahsulot hali olinmagan — tasdiq SHART", () => {
    expect(
      readOrderReplacement({ replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup", old_item_collected_at: null }),
    ).toEqual({
      isReplacement: true,
      isReplacementReturn: false,
      oldOrderId: "81",
      state: "awaiting_old_pickup",
      collectedAt: null,
      needsOldItemConfirm: true,
    });
  });

  it("holat `null` (eski yozuv) ham «olinmagan» — tasdiq shart (backend ham shunday)", () => {
    expect(readOrderReplacement({ replacement_of_order_id: 81, replacement_state: null }).needsOldItemConfirm).toBe(true);
  });

  it("eski mahsulot olingan yoki marketga qaytgan — tasdiq kerak emas (qaytarilgan sotuvni qayta sotish)", () => {
    const collected = readOrderReplacement({
      replacement_of_order_id: "81",
      replacement_state: "old_collected",
      old_item_collected_at: "2026-11-04T09:30:00.000Z",
    });
    expect(collected.needsOldItemConfirm).toBe(false);
    expect(collected.collectedAt).toBe("2026-11-04T09:30:00.000Z");
    expect(readOrderReplacement({ replacement_of_order_id: "81", replacement_state: "old_returned" }).needsOldItemConfirm).toBe(
      false,
    );
  });

  it("eski (qaytariladigan) buyurtma — belgi bor, lekin sotish darvozasi YO'Q", () => {
    expect(readOrderReplacement({ is_replacement_return: true, replacement_state: "awaiting_old_pickup" })).toMatchObject({
      isReplacement: false,
      isReplacementReturn: true,
      state: "awaiting_old_pickup",
      needsOldItemConfirm: false,
    });
  });

  it("oddiy buyurtma va noto'g'ri qiymatlar — hech narsa", () => {
    const none = {
      isReplacement: false,
      isReplacementReturn: false,
      oldOrderId: null,
      state: null,
      collectedAt: null,
      needsOldItemConfirm: false,
    };
    expect(readOrderReplacement({ id: "5" })).toEqual(none);
    expect(readOrderReplacement(null)).toEqual(none);
    expect(readOrderReplacement({ replacement_of_order_id: "  ", is_replacement_return: "true", replacement_state: "x" })).toEqual(
      none,
    );
  });
});

describe("formatReplacementOrderRef", () => {
  it("ichki id → ko'rinadigan raqam «№EL-…» (id + 100000)", () => {
    expect(formatReplacementOrderRef("81")).toBe("№EL-100081");
    expect(formatReplacementOrderRef(1234)).toBe("№EL-101234");
  });

  it("raqamsiz id — o'zgarmay", () => {
    expect(formatReplacementOrderRef("abc")).toBe("№abc");
  });
});
