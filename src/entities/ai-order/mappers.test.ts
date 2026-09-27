import { describe, expect, it } from "vitest";
import { createOrderSchema } from "../../pages/orders/create/model/orderCreateForm";
import { aiPreviewToFormValues, buildAiConfirmPayload } from "./mappers";
import type { AiPreviewOrder } from "./types";

/**
 * AI BUYURTMA — PAYLOAD MAPPERLARI (bpy3XwyA).
 *
 * ⚠️ Gateway `forbidNonWhitelisted: true` — payloaddagi bitta ortiqcha maydon
 * butun so'rovni 400 bilan yiqitadi. Shu sabab chiqish kalitlari ANIQ
 * ro'yxat bilan tekshiriladi.
 */

const preview = (overrides: Partial<AiPreviewOrder> = {}): AiPreviewOrder => ({
  customer_name: "Aliyev Vali",
  phone_number: "+998901234567",
  extra_number: null,
  region_id: "11",
  region_name: "Toshkent shahri",
  region_given: true,
  district_id: "101",
  district_name: "Chilonzor",
  district_candidates: [{ id: "101", label: "Chilonzor", region_name: "Toshkent shahri" }],
  address: "9-kvartal, 12-uy",
  items: [
    {
      name: "telefon ushlagich",
      quantity: 2,
      product_id: "501",
      resolved_name: "Telefon ushlagich",
      candidates: [{ id: "501", name: "Telefon ushlagich" }],
    },
  ],
  total_price: 250000,
  comment: "18:00 dan keyin",
  operator: "sevinch",
  where_deliver: "address",
  ...overrides,
});

/** UI/backend preview'ga qo'shishi mumkin bo'lgan metadata. */
const withUiMetadata = (order: AiPreviewOrder) => ({ ...order, ready: true, issues: ["price_missing"] });

const AI_METADATA_KEYS = ["candidates", "district_candidates", "region_given", "resolved_name", "ready", "issues"];

const allKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...allKeys(inner)]);
  }
  return [];
};

describe("buildAiConfirmPayload", () => {
  it("AI metadatasi (candidates, district_candidates, region_given, resolved_name, ready, issues) payloadda YO'Q", () => {
    const payload = buildAiConfirmPayload([withUiMetadata(preview())], { marketId: "7", includeMarketId: true });

    const keys = allKeys(payload);
    for (const key of AI_METADATA_KEYS) expect(keys).not.toContain(key);
  });

  it("faqat gateway kutgan maydonlar — to'liq shakl", () => {
    const payload = buildAiConfirmPayload([preview({ extra_number: "+998 97 111 22 33" })], {
      marketId: "7",
      includeMarketId: true,
    });

    expect(payload).toEqual({
      market_id: "7",
      orders: [
        {
          customer: {
            name: "Aliyev Vali",
            phone_number: "+998901234567",
            district_id: "101",
            extra_number: "97-111-22-33",
            address: "9-kvartal, 12-uy",
          },
          items: [{ product_id: "501", quantity: 2 }],
          district_id: "101",
          total_price: 250000,
          where_deliver: "address",
          address: "9-kvartal, 12-uy",
          comment: "18:00 dan keyin",
          operator: "sevinch",
        },
      ],
    });
  });

  it.each(["+998 (90) 123-45-67", "90 123 45 67", "901234567", "+998901234567"])(
    "telefon %j → +998901234567",
    (phone) => {
      const [order] = buildAiConfirmPayload([preview({ phone_number: phone })], { includeMarketId: false }).orders;
      expect(order.customer.phone_number).toBe("+998901234567");
    },
  );

  it.each(["90 123 45", "90 123 45 678", "+998 90 123 45 6", "", "raqam yo'q"])(
    "9 xonali bo'lmagan telefon %j → bo'sh satr (yolg'on raqam yasalmaydi)",
    (phone) => {
      const [order] = buildAiConfirmPayload([preview({ phone_number: phone })], { includeMarketId: false }).orders;
      expect(order.customer.phone_number).toBe("");
    },
  );

  it("noto'g'ri qo'shimcha raqam yuborilmaydi", () => {
    const [order] = buildAiConfirmPayload([preview({ extra_number: "97 111" })], { includeMarketId: false }).orders;
    expect(order.customer).not.toHaveProperty("extra_number");
  });

  it("`total_price` number (satr emas), `items[].quantity` butun son", () => {
    const [order] = buildAiConfirmPayload(
      [preview({ total_price: 150000, items: [{ name: "x", quantity: 2.6, product_id: "9", candidates: [] }] })],
      { includeMarketId: false },
    ).orders;

    expect(typeof order.total_price).toBe("number");
    expect(order.total_price).toBe(150000);
    expect(order.items[0].quantity).toBe(3);
    expect(Number.isInteger(order.items[0].quantity)).toBe(true);
  });

  it("`allow_free_text` bayrog'isiz product_id siz item uchun `product_name` payloadga TUSHMAYDI", () => {
    const [order] = buildAiConfirmPayload(
      [
        preview({
          items: [
            { name: "Katalogdagi", quantity: 1, product_id: "501", candidates: [] },
            { name: "Noma'lum mahsulot", quantity: 1, product_id: null, candidates: [] },
            { name: "Bayroq false", quantity: 1, candidates: [], allow_free_text: false },
          ],
        }),
      ],
      { includeMarketId: false },
    ).orders;

    expect(order.items).toEqual([{ product_id: "501", quantity: 1 }]);
    expect(allKeys(order)).not.toContain("product_name");
  });

  it("operator \"katalogda yo'q\" deb belgilasa (`allow_free_text: true`) → `{ product_name, quantity, allow_unlisted_product: true }`", () => {
    const [order] = buildAiConfirmPayload(
      [preview({ items: [{ name: " Avto changyutgich ", quantity: 1, candidates: [], allow_free_text: true }] })],
      { includeMarketId: false },
    ).orders;

    // ⚠️ Backend bayroqsiz `product_name` ni 400 bilan rad etadi (wgqxS0Cp #9).
    expect(order.items).toEqual([{ product_name: "Avto changyutgich", quantity: 1, allow_unlisted_product: true }]);
  });

  it("tahlil javobidagi `draft_id` bo'lsa har buyurtmaga qo'shiladi, bo'lmasa kalit umuman yo'q", () => {
    const withDraft = buildAiConfirmPayload([preview({ draft_id: "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60" })], {
      includeMarketId: false,
    }).orders[0];
    const withoutDraft = buildAiConfirmPayload([preview()], { includeMarketId: false }).orders[0];

    expect(withDraft.draft_id).toBe("3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60");
    expect(withoutDraft).not.toHaveProperty("draft_id");
  });

  it("`status` va `region_id` payloadda umuman yo'q", () => {
    const payload = buildAiConfirmPayload([preview()], { marketId: "7", includeMarketId: true });

    expect(allKeys(payload)).not.toContain("status");
    expect(allKeys(payload)).not.toContain("region_id");
  });

  it("`district_id` ham yuqori darajada, ham `customer` ichida", () => {
    const [order] = buildAiConfirmPayload([preview()], { includeMarketId: false }).orders;
    expect(order.district_id).toBe("101");
    expect(order.customer.district_id).toBe("101");
  });

  it("market roli uchun `market_id` yuborilmaydi, admin/registrator uchun yuboriladi", () => {
    expect(buildAiConfirmPayload([preview()], { marketId: "7", includeMarketId: false })).not.toHaveProperty(
      "market_id",
    );
    expect(buildAiConfirmPayload([preview()], { marketId: 7, includeMarketId: true }).market_id).toBe("7");
  });
});

describe("aiPreviewToFormValues", () => {
  it("telefon `+998901234567` → \"901234567\", narx → formatlangan satr", () => {
    const values = aiPreviewToFormValues(preview({ extra_number: "+998 97 111 22 33" }));

    expect(values.customer.phone).toBe("901234567");
    expect(values.customer.extra_phone).toBe("971112233");
    expect(values.details.total_price).toBe("250 000");
    expect(values.details.items).toEqual([{ product_id: "501", quantity: 2 }]);
  });

  it("natija mavjud yup sxemasidan (createOrderSchema) o'tadi", async () => {
    const values = aiPreviewToFormValues(withUiMetadata(preview()));

    await expect(createOrderSchema(false).validate({ market: null, ...values })).resolves.toBeDefined();
  });

  it("uy manzilisiz `center` yetkazish ham sxemadan o'tadi", async () => {
    const values = aiPreviewToFormValues(preview({ where_deliver: "center", address: null, comment: null, operator: null }));

    expect(values.customer.address).toBe("");
    await expect(createOrderSchema(false).validate({ market: null, ...values })).resolves.toBeDefined();
  });

  it("noto'g'ri telefon forma'ga bo'sh tushadi — sxema uni ushlaydi", async () => {
    const values = aiPreviewToFormValues(preview({ phone_number: "90 123 45 678" }));

    expect(values.customer.phone).toBe("");
    await expect(createOrderSchema(false).validate({ market: null, ...values })).rejects.toThrow();
  });
});
