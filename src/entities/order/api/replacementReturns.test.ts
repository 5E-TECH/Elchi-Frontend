import { describe, expect, it } from "vitest";
import { replacementReturnsQueryKey, toReplacementReturnsPage } from "./replacementReturns";

/**
 * lQjt6sKP — `GET orders/replacement/returns` javobi (backend `findReplacementReturns` + gateway mijoz ismi):
 * `{ statusCode, message, data: { items, total, page, limit } }`; `sold_at` — epoch-millisekund MATNI.
 */
const ROW = {
  id: "81",
  status: "sold",
  market_id: "37",
  customer_id: "801",
  customer: { id: "801", name: "Ali Valiyev", phone_number: "+998901234567" },
  total_price: "250000",
  where_deliver: "address",
  comment: null,
  sold_at: "1761900000000",
  createdAt: "2026-10-30T10:00:00.000Z",
  items: [
    { product_id: "5", product_name: "Telefon", quantity: 1 },
    { product_id: null, product_name: null, quantity: "2" },
  ],
  replacement_state: "old_collected",
  old_item_collected_at: "2026-11-03T09:15:00.000Z",
  replacement_order_id: "90",
  replacement_order_status: "sold",
};

describe("toReplacementReturnsPage (lQjt6sKP)", () => {
  it("qobiqni ochadi; summa va soni songa, epoch `sold_at` — ISO ga aylanadi", () => {
    const page = toReplacementReturnsPage({
      statusCode: 200,
      message: "ok",
      data: { items: [ROW], total: 41, page: 3, limit: 20 },
    });

    expect(page).toMatchObject({ total: 41, page: 3, limit: 20 });
    expect(page.items).toEqual([
      {
        id: "81",
        status: "sold",
        market_id: "37",
        customer: { id: "801", name: "Ali Valiyev", phone_number: "+998901234567" },
        total_price: 250000,
        sold_at: new Date(1761900000000).toISOString(),
        createdAt: "2026-10-30T10:00:00.000Z",
        items: [
          { product_id: "5", product_name: "Telefon", quantity: 1 },
          { product_id: null, product_name: null, quantity: 2 },
        ],
        replacement_state: "old_collected",
        old_item_collected_at: "2026-11-03T09:15:00.000Z",
        replacement_order_id: "90",
        replacement_order_status: "sold",
      },
    ]);
  });

  it("yangi buyurtma o'chirilgan (`replacement_order_id: null`), noma'lum holat va mijozsiz qator — yiqitmaydi", () => {
    const [row] = toReplacementReturnsPage({
      data: {
        items: [{ ...ROW, replacement_order_id: null, replacement_order_status: null, replacement_state: "weird", customer: null, sold_at: null }],
        total: 1,
      },
    }).items;

    expect(row.replacement_order_id).toBeNull();
    expect(row.replacement_order_status).toBeNull();
    expect(row.replacement_state).toBeNull();
    expect(row.customer).toBeNull();
    expect(row.sold_at).toBeNull();
  });

  it("id'siz yoki obyekt bo'lmagan qatorlar tashlanadi; total kamida qatorlar soni, page/limit zaxirasi", () => {
    const page = toReplacementReturnsPage({ data: { items: [ROW, { id: "" }, null, "x"] } });

    expect(page.items.map((row) => row.id)).toEqual(["81"]);
    expect(page.total).toBe(1);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(1);
  });

  it("bo'sh yoki g'alati javob — bo'sh sahifa", () => {
    expect(toReplacementReturnsPage(undefined)).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    expect(toReplacementReturnsPage({ data: null })).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it("kesh kaliti `orders` ildizi ostida — yaratish va sotishdagi `[\"orders\"]` yangilanishi buni ham yangilaydi", () => {
    expect(replacementReturnsQueryKey({ state: "awaiting_old_pickup", page: 1, limit: 20 })).toEqual([
      "orders",
      "replacement-returns",
      { state: "awaiting_old_pickup", page: 1, limit: 20 },
    ]);
  });
});
