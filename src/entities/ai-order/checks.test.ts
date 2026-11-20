import { describe, expect, it } from "vitest";
import { buildAiConfirmPayload } from "./mappers";
import { isBlockingCheckCode, normalizeAiChecks, normalizeDistrictMatch } from "./checks";
import type { AiPreviewOrder } from "./types";

/**
 * AI TEKSHIRUVLARI — server javobini himoyalangan o'qish (backend: «noma'lum `code` e'tiborsiz qoldirilsin»).
 */

describe("normalizeAiChecks", () => {
  it("tanish kodlar o'z shaklida; noma'lum kod, buzuq maydon va obyekt bo'lmagan element tashlanadi", () => {
    expect(
      normalizeAiChecks([
        { code: "district_low_confidence" },
        { code: "price_check", kind: "too_high", mentions: [150000, "20 000", Number.NaN, 20000] },
        { code: "price_check", kind: "boshqa" },
        { code: "qty_check", item_index: 2 },
        { code: "qty_check", item_index: -1 },
        { code: "duplicate_items", item_indexes: [0, 1] },
        { code: "duplicate_items", item_indexes: [3] },
        { code: "phone_is_market" },
        { code: "same_phone_multi", other_index: 4 },
        { code: "yangi_kod", extra: true },
        null,
        "price_check",
      ]),
    ).toEqual([
      { code: "district_low_confidence" },
      { code: "price_check", kind: "too_high", mentions: [150000, 20000] },
      { code: "price_check", kind: "mismatch", mentions: [] },
      { code: "qty_check", item_index: 2 },
      { code: "duplicate_items", item_indexes: [0, 1] },
      { code: "phone_is_market" },
      { code: "same_phone_multi", other_index: 4 },
    ]);
  });

  it("massiv bo'lmasa (eski backend) — bo'sh ro'yxat", () => {
    expect(normalizeAiChecks(undefined)).toEqual([]);
    expect(normalizeAiChecks({ code: "price_check" })).toEqual([]);
  });

  it("faqat `district_low_confidence` va `price_check` bloklaydi", () => {
    expect(["district_low_confidence", "price_check"].every(isBlockingCheckCode)).toBe(true);
    expect(["qty_check", "phone_is_market", "same_phone_multi", "duplicate_items", "x"].some(isBlockingCheckCode)).toBe(false);
  });

  it("`district_match`: `ai_text` bo'sh bo'lsa — `null`", () => {
    expect(normalizeDistrictMatch({ method: "fuzzy", ai_text: " Chilanzar ", score: 0.8 })).toEqual({
      method: "fuzzy",
      ai_text: "Chilanzar",
      score: 0.8,
    });
    expect(normalizeDistrictMatch({ method: "exact", ai_text: "  " })).toBeNull();
    expect(normalizeDistrictMatch(null)).toBeNull();
  });
});

describe("buildAiConfirmPayload — `ack_checks`", () => {
  const preview = (overrides: Partial<AiPreviewOrder> = {}): AiPreviewOrder => ({
    customer_name: "Aliyev Vali",
    phone_number: "+998901234567",
    region_id: "11",
    region_name: "Toshkent shahri",
    region_given: true,
    district_id: "101",
    district_name: "Chilonzor",
    district_candidates: [],
    items: [{ name: "x", quantity: 1, product_id: "501", candidates: [], source_index: 0 }],
    total_price: 150000,
    where_deliver: "center",
    draft_id: "draft-1",
    index: 0,
    ...overrides,
  });

  it("belgilangan bloklovchi kodlar `ack_checks` (takrorsiz); yumshoq/noma'lum kod va frontend holati ketmaydi", () => {
    const [order] = buildAiConfirmPayload(
      [
        preview({
          acked_checks: ["price_check", "price_check", "qty_check" as never, "district_low_confidence"],
          server_required_acks: ["price_check"],
          checks: [{ code: "price_check", kind: "mismatch", mentions: [1] }],
          district_match: { method: "fuzzy", ai_text: "x", score: 1 },
          region_inferred: true,
        }),
      ],
      { includeMarketId: false },
    ).orders;

    expect(order.ack_checks).toEqual(["price_check", "district_low_confidence"]);
    for (const key of ["acked_checks", "server_required_acks", "checks", "district_match", "region_inferred"]) {
      expect(order).not.toHaveProperty(key);
    }
    expect(order.items).toEqual([{ product_id: "501", quantity: 1 }]);
  });

  it("belgilanmagan bo'lsa `ack_checks` kaliti umuman yo'q", () => {
    const [order] = buildAiConfirmPayload([preview({ acked_checks: [] })], { includeMarketId: false }).orders;
    expect(order).not.toHaveProperty("ack_checks");
  });
});
