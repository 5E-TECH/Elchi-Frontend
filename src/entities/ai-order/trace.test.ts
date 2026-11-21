import { describe, expect, it } from "vitest";
import { formatMaskedPhone, toAiOrderTrace } from "./trace";

/** «AI IZI» javobini himoyalangan o'qish (backend `AiDraftTrace`, gateway `{ statusCode, data }` ichida). */

const RAW = {
  order_id: 10241,
  draft_id: "d-1",
  item_index: 0,
  market_id: "7",
  user_id: "77",
  confirmed_by: 77,
  confirmed_at: "2026-11-21T09:15:00.000Z",
  created_at: "2026-11-21T09:12:00.000Z",
  source_kind: "text",
  source_text: "1) Dilnoza [TEL_1], Lutfiy 14-uy",
  source_hash: "abc",
  source_purged: false,
  image_count: "1",
  model: "claude-sonnet-5",
  prompt_version: "2026-10-26.1",
  outcome: "confirmed",
  ai_suggestion: {
    index: 0,
    customer_name: "Dilnoza Karimova",
    phone_masked: "+99890*****76",
    extra_masked: null,
    region_id: 11,
    district_id: "103",
    address: "Lutfiy, 14-uy",
    total_price: "1850000",
    where_deliver: "address",
    comment: "",
    operator: null,
    is_replacement: false,
    items: [{ name: "kurtka", product_id: 501, quantity: 1 }, { name: "shapka", product_id: null, quantity: "1" }],
    district_match: { method: "fuzzy", ai_text: "Qatortol", score: 0.7 },
    region_inferred: true,
    check_codes: ["district_low_confidence", "price_check", 5],
  },
  edited_fields: ["district_id", "total_price", "nomalum", "items"],
  cost: { draft_cost_usd: 0.01, draft_cost_uzs: 130, calls: 1, linked_orders: 3, order_cost_uzs: 43 },
};

describe("toAiOrderTrace", () => {
  it("gateway qobig'i ichidan; id/son matnga, noma'lum maydon va kod tashlanadi", () => {
    const trace = toAiOrderTrace({ statusCode: 200, message: "ok", data: RAW });

    expect(trace).toMatchObject({
      order_id: "10241",
      item_index: 0,
      confirmed_by: "77",
      image_count: 1,
      model: "claude-sonnet-5",
      prompt_version: "2026-10-26.1",
      source_text: "1) Dilnoza [TEL_1], Lutfiy 14-uy",
      source_purged: false,
      edited_fields: ["district_id", "total_price", "items"],
    });
    expect(trace?.ai_suggestion).toMatchObject({
      region_id: "11",
      district_id: "103",
      total_price: 1850000,
      comment: null,
      items: [
        { name: "kurtka", product_id: "501", quantity: 1 },
        { name: "shapka", product_id: null, quantity: 1 },
      ],
      district_match: { method: "fuzzy", ai_text: "Qatortol", score: 0.7 },
      region_inferred: true,
      check_codes: ["district_low_confidence", "price_check"],
    });
  });

  it("muddat tugagan iz: matn va AI taklifi `null`, `edited_fields` qoladi; `edited_fields` yo'q — `null` (noma'lum)", () => {
    const purged = toAiOrderTrace({ ...RAW, source_text: null, source_purged: true, ai_suggestion: null });
    expect(purged).toMatchObject({ source_text: null, source_purged: true, ai_suggestion: null });
    expect(purged?.edited_fields).toEqual(["district_id", "total_price", "items"]);

    expect(toAiOrderTrace({ ...RAW, edited_fields: undefined })?.edited_fields).toBeNull();
  });

  it("`order_id` yo'q yoki obyekt emas — `null`", () => {
    expect(toAiOrderTrace({ data: { model: "x" } })).toBeNull();
    expect(toAiOrderTrace(null)).toBeNull();
    expect(toAiOrderTrace("404")).toBeNull();
  });
});

describe("formatMaskedPhone", () => {
  it("maskalangan va to'liq raqam bir xil ko'rinishda — o'rtasi doim yashirin", () => {
    expect(formatMaskedPhone("+99890*****76")).toBe("+998 90 *** ** 76");
    expect(formatMaskedPhone("+998901234567")).toBe("+998 90 *** ** 67");
    expect(formatMaskedPhone("901234567")).toBe("+998 90 *** ** 67");
    expect(formatMaskedPhone("90 123")).toBeNull();
    expect(formatMaskedPhone(null)).toBeNull();
  });
});
