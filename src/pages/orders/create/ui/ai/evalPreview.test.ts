import { describe, expect, it } from "vitest";
import { AI_ISSUES, PRICE_CONFIRM_THRESHOLD, evalPreview, type AiDraftOrder } from "./evalPreview";
import { previewSig } from "./previewSig";

/**
 * AI PREVIEW — TAYYORLIK VA IMZO (s92KyWm0, yDLrGAz8).
 */

const order = (overrides: Partial<AiDraftOrder> = {}): AiDraftOrder => ({
  customer_name: "Aliyev Vali",
  phone_number: "901234567",
  extra_number: null,
  region_id: "11",
  region_name: "Toshkent shahri",
  region_given: true,
  district_id: "101",
  district_name: "Chilonzor",
  district_candidates: [],
  address: "",
  items: [{ name: "telefon ushlagich", quantity: 2, product_id: "501", candidates: [] }],
  total_price: 150000,
  comment: "",
  operator: "",
  where_deliver: "center",
  ...overrides,
});

describe("evalPreview", () => {
  it("to'liq to'g'ri buyurtma — ready, kamchilik yo'q", () => {
    expect(evalPreview(order())).toEqual({ ready: true, issues: [] });
  });

  it.each<[string, Partial<AiDraftOrder>, (typeof AI_ISSUES)[number]]>([
    ["ism yo'q", { customer_name: "  " }, "name_missing"],
    ["telefon yo'q", { phone_number: "" }, "phone_invalid"],
    ["telefon noto'g'ri (10 xona)", { phone_number: "90 123 45 678" }, "phone_invalid"],
    ["viloyat yo'q", { region_id: null }, "region_missing"],
    ["tuman yo'q", { district_id: null }, "district_missing"],
    ["narx null", { total_price: null }, "price_missing"],
    ["narx 10 000 dan kichik va tasdiqlanmagan", { total_price: 5000 }, "price_confirm"],
    ["mahsulot yo'q", { items: [] }, "items_missing"],
    [
      "itemda product_id ham allow_free_text ham yo'q",
      { items: [{ name: "Noma'lum", quantity: 1, product_id: null, candidates: [] }] },
      "item_unresolved",
    ],
  ])("%s → %s, karta ready emas", (_label, overrides, issue) => {
    const result = evalPreview(order(overrides));
    expect(result.issues).toEqual([issue]);
    expect(result.ready).toBe(false);
  });

  it("8 ta kamchilik turi ham qamrab olingan (kalitlar, matn emas)", () => {
    expect(AI_ISSUES).toEqual([
      "name_missing",
      "phone_invalid",
      "region_missing",
      "district_missing",
      "price_missing",
      "price_confirm",
      "items_missing",
      "item_unresolved",
    ]);
  });

  it("total_price=0 tasdiq talab qiladi; belgilangach ready", () => {
    expect(evalPreview(order({ total_price: 0 })).issues).toEqual(["price_confirm"]);
    expect(evalPreview(order({ total_price: 0, price_confirmed: true })).ready).toBe(true);
  });

  it(`total_price=5000 tasdiq talab qiladi, ${PRICE_CONFIRM_THRESHOLD} va 150000 talab qilmaydi`, () => {
    expect(evalPreview(order({ total_price: 5000 })).ready).toBe(false);
    expect(evalPreview(order({ total_price: PRICE_CONFIRM_THRESHOLD })).ready).toBe(true);
    expect(evalPreview(order({ total_price: 150000 })).ready).toBe(true);
  });

  it("katalogda yo'q item `allow_free_text: true` bilan hal bo'lgan hisoblanadi", () => {
    const result = evalPreview(
      order({ items: [{ name: "Avto changyutgich", quantity: 1, candidates: [], allow_free_text: true }] }),
    );
    expect(result.ready).toBe(true);
  });

  it("bir nechta kamchilik birga qaytadi", () => {
    expect(evalPreview(order({ customer_name: "", district_id: null, total_price: null })).issues).toEqual([
      "name_missing",
      "district_missing",
      "price_missing",
    ]);
  });
});

describe("previewSig", () => {
  it("telefon formati va mahsulot tartibi imzoni o'zgartirmaydi", () => {
    const a = order({
      phone_number: "+998 90 123 45 67",
      items: [
        { name: "a", quantity: 1, product_id: "2", candidates: [] },
        { name: "b", quantity: 3, product_id: "1", candidates: [] },
      ],
    });
    const b = order({
      phone_number: "901234567",
      items: [
        { name: "b", quantity: 3, product_id: "1", candidates: [] },
        { name: "a", quantity: 1, product_id: "2", candidates: [] },
      ],
    });
    expect(previewSig(a)).toBe(previewSig(b));
    expect(previewSig(a)).toBe("901234567|1:3,2:1|150000");
  });

  it("narx yoki son farq qilsa imzo boshqa", () => {
    expect(previewSig(order())).not.toBe(previewSig(order({ total_price: 160000 })));
    expect(previewSig(order())).not.toBe(
      previewSig(order({ items: [{ name: "x", quantity: 3, product_id: "501", candidates: [] }] })),
    );
  });

  it("erkin matnli (product_id siz) boshqa-boshqa mahsulotlar bir xil imzo BERMAYDI", () => {
    const first = order({ items: [{ name: "Qizil ko'ylak", quantity: 1, candidates: [], allow_free_text: true }] });
    const second = order({ items: [{ name: "Ko'k shim", quantity: 1, candidates: [], allow_free_text: true }] });
    expect(previewSig(first)).not.toBe(previewSig(second));
  });
});
