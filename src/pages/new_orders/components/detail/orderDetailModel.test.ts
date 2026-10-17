import { describe, expect, it } from "vitest";
import {
  buildActionOrder,
  buildTrackingContext,
  isCatalogLessItem,
  normalizeOrderDetail,
  readOrderCreatedAt,
} from "./orderDetailModel";

describe("normalizeOrderDetail — xom javobni tozalash", () => {
  it("⭐ mock API `{}` va `{ data: {} }` — null (sahifa «topilmadi», yiqilmaydi)", () => {
    expect(normalizeOrderDetail({})).toBeNull();
    expect(normalizeOrderDetail({ statusCode: 200, data: {} })).toBeNull();
    expect(normalizeOrderDetail(null)).toBeNull();
    expect(normalizeOrderDetail("x")).toBeNull();
  });

  it("⭐ maydonlar yo'q bo'lsa ham yaroqli shakl: status \"\", items [], customer bo'sh satrlar", () => {
    const order = normalizeOrderDetail({ data: { id: 96 } });
    expect(order).toMatchObject({
      id: "96",
      status: "",
      where_deliver: "",
      total_price: 0,
      to_be_paid: 0,
      paid_amount: 0,
      comment: null,
      address: null,
      items: [],
      customer: { id: "", name: "", phone_number: "" },
    });
  });

  it("summa matn (\"150000.00\") — son 150000; xom maydonlar saqlanadi", () => {
    const order = normalizeOrderDetail({
      id: "1",
      total_price: "150000.00",
      to_be_paid: "150000",
      market: { name: "Zamon" },
      post_id: "78",
      items: [{ id: 5, quantity: "2", product: null, product_name: "tv" }, "buzuq"],
    });
    expect(order?.total_price).toBe(150000);
    expect(order?.to_be_paid).toBe(150000);
    expect(order?.post_id).toBe("78");
    expect(order?.market).toEqual({ name: "Zamon" });
    expect(order?.items).toEqual([expect.objectContaining({ id: "5", quantity: 2, product: null, product_name: "tv" })]);
    expect(isCatalogLessItem(order!.items[0])).toBe(true);
  });

  it("yaratilgan vaqt — `createdAt` yoki `created_at`", () => {
    expect(readOrderCreatedAt(normalizeOrderDetail({ id: 1, createdAt: "2026-07-20T08:38:49.865Z" })!)).toBe(
      "2026-07-20T08:38:49.865Z",
    );
    expect(readOrderCreatedAt(normalizeOrderDetail({ id: 1, created_at: "2026-07-19" })!)).toBe("2026-07-19");
    expect(readOrderCreatedAt(normalizeOrderDetail({ id: 1 })!)).toBeNull();
  });
});

describe("buildActionOrder — sotish/bekor qilish oynalari uchun", () => {
  it("market kelmasa «-», dalil shartlari null; katalogsiz qator id'si product_id o'rniga qo'yilmaydi", () => {
    const action = buildActionOrder(
      normalizeOrderDetail({
        id: "1",
        status: "waiting",
        items: [{ id: "124", quantity: 2, product_id: null, product_name: "tv", product: null }],
      }),
    );
    expect(action?.market).toEqual({ name: "-", expense_proof_conditions: null });
    expect(action?.items[0]).toMatchObject({ id: "124", product_id: null, product: { id: null, name: "tv" } });
    expect(action?.product_quantity).toBe(2);
  });
});

describe("buildTrackingContext — tarix jumlalaridagi nomlar", () => {
  it("⭐ D-05: manzil filiali bo'lmasa — buyurtmaning o'z filiali («Filial filialiga» emas)", () => {
    const context = buildTrackingContext(normalizeOrderDetail({ id: "1", branch: { id: "15", name: "Urgut" } }));
    expect(context.branchName).toBe("Urgut");
    expect(context.branchNamesById).toEqual({ "15": "Urgut" });
  });

  it("aniq manzil filiali (`destination_branch`) ustun", () => {
    const context = buildTrackingContext(
      normalizeOrderDetail({ id: "1", branch: { id: "1", name: "Toshkent HQ" }, destination_branch: { id: "15", name: "Urgut" } }),
    );
    expect(context.branchName).toBe("Urgut");
  });

  it("filial umuman yo'q — null (jumlada umumiy «Filial»)", () => {
    expect(buildTrackingContext(normalizeOrderDetail({ id: "1" })).branchName).toBeNull();
  });
});
