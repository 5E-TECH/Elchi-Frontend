import { describe, expect, it } from "vitest";
import { getOrderItemName } from "../../../shared/lib/orderItemName";

/**
 * KATALOGSIZ MAHSULOT — hamkor (Partner API) buyurtmalari.
 *
 * REAL XATO (2026-09-11, birinchi jonli posilkadan keyin): BeePost'dan
 * kelgan buyurtmani ochganda sahifa butunlay yiqilardi —
 * `Cannot read properties of null (reading 'name')`.
 *
 * Sabab: Elchi'ning o'z oqimida mahsulot DOIM katalogdan keladi
 * (`product_id` to'la, nom bog'lanishdan olinadi). Hamkor buyurtmasida esa
 * teskari: `product_id` BO'SH, nom `product_name` da matn bo'lib keladi.
 * `OrderCard` esa `item.product.name` ni himoyasiz o'qirdi.
 *
 * Bu yerda nom tanlash qoidasi qulflanadi. Qoida uchala holatni ham
 * qoplashi kerak, chunki bitta ekranda ikkala xil buyurtma yonma-yon turadi.
 */

type Item = {
  product?: { name: string } | null;
  product_name?: string | null;
  product_id?: string | null;
};

/** `OrderCard` va yorliq chop etishda ishlatiladigan qoida. */
const displayName = (item: Item, fallback = "—") =>
  item.product?.name ?? item.product_name ?? fallback;

describe("mahsulot nomini tanlash", () => {
  it("katalog mahsuloti — nom bog'lanishdan olinadi", () => {
    expect(displayName({ product: { name: "Televizor" }, product_id: "6" })).toBe(
      "Televizor",
    );
  });

  it("hamkor mahsuloti — `product` YO'Q, nom `product_name` dan", () => {
    // Aynan shu holat sahifani yiqitardi.
    expect(displayName({ product: null, product_name: "tv", product_id: null })).toBe(
      "tv",
    );
  });

  it("`product` umuman berilmagan bo'lsa ham yiqilmaydi", () => {
    expect(displayName({ product_name: "quti" })).toBe("quti");
  });

  it("ikkalasi ham yo'q — zaxira matn, xato emas", () => {
    expect(displayName({})).toBe("—");
    expect(displayName({ product: null, product_name: null })).toBe("—");
  });

  it("katalog nomi `product_name` dan USTUN", () => {
    // Katalog — haqiqat manbai; hamkor yuborgan matn eskirgan bo'lishi mumkin.
    expect(
      displayName({ product: { name: "Katalog nomi" }, product_name: "eski nom" }),
    ).toBe("Katalog nomi");
  });
});

describe("ro'yxat bo'sh bo'lsa", () => {
  it("`items` yo'q bo'lsa ham render yiqilmaydi", () => {
    const items: Item[] | null | undefined = null;
    expect(() => (items ?? []).map((i) => displayName(i))).not.toThrow();
    expect((items ?? []).length).toBe(0);
  });
});

describe("getOrderItemName (umumiy qoida — detal, tahrirlash oynasi, qisman sotish)", () => {
  it("katalog mahsuloti — nom avvalgidek `product.name` dan (regressiya yo'q)", () => {
    expect(getOrderItemName({ product: { name: "Televizor" }, product_id: "6", product_name: "eski" }, "Mahsulot")).toBe(
      "Televizor",
    );
  });

  it("tashqi buyurtma (`product: null`) — nom `product_name` dan", () => {
    // Jonli #1251134: 4 ta qator ham shunday keladi.
    expect(getOrderItemName({ product: null, product_id: null, product_name: "Avto changyutgich" }, "Mahsulot")).toBe(
      "Avto changyutgich",
    );
  });

  it("nom yo'q, lekin katalog id bor — `#<product_id>`", () => {
    expect(getOrderItemName({ product: null, product_id: "8", product_name: null }, "Mahsulot")).toBe("#8");
  });

  it("hech narsa yo'q — berilgan zaxira matn", () => {
    expect(getOrderItemName({ product: null, product_id: null, product_name: null }, "Mahsulot")).toBe("Mahsulot");
    expect(getOrderItemName({}, "—")).toBe("—");
  });
});
