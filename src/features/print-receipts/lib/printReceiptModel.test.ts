import { describe, expect, it } from "vitest";
import { normalizeReceiptText, splitFaceRuns } from "./printReceiptFonts";
import {
  formatReceiptDate,
  receiptAmountOf,
  toReceiptOrderModel,
  type ReceiptOrderSource,
} from "./printReceiptModel";
import { RECEIPT_SAMPLES } from "./receiptSamples";

/** HJ5sLHiz — chek modeli (TZ F3–F4, ega qarorlari 1–3, 2026-10-29). */

const order = (patch: Partial<ReceiptOrderSource> = {}): ReceiptOrderSource => ({
  id: "81",
  status: "new",
  where_deliver: "address",
  total_price: 185_000,
  createdAt: "2026-10-23T05:00:00.000Z",
  ...patch,
});

describe("receipt amount (ega qarori 1 va 3)", () => {
  it("boxes total_price − paid_online_amount, not to_be_paid; paid_online_amount missing → 0", () => {
    expect(receiptAmountOf(order({ total_price: 185_000 }))).toEqual({
      kind: "collect",
      value: "185 000",
      total: null,
    });
    // `to_be_paid` (sotuvgacha 0, marketga to'lanadigan pul) summaga ta'sir qilmaydi.
    expect(receiptAmountOf({ ...order(), to_be_paid: 0 } as ReceiptOrderSource)).toEqual({
      kind: "collect",
      value: "185 000",
      total: null,
    });
    expect(receiptAmountOf(order({ total_price: "12500000" }))).toEqual({
      kind: "collect",
      value: "12 500 000",
      total: null,
    });
  });

  it("partly paid online → collect + «jami <total_price>»; fully paid → «To'langan»", () => {
    expect(receiptAmountOf(order({ total_price: 250_000, paid_online_amount: 130_000 }))).toEqual({
      kind: "collect",
      value: "120 000",
      total: "250 000",
    });
    expect(receiptAmountOf(order({ total_price: 250_000, paid_online_amount: 250_000 }))).toEqual({
      kind: "label",
      text: "To'langan",
    });
    expect(receiptAmountOf(order({ total_price: 250_000, paid_online_amount: 300_000 }))).toEqual({
      kind: "label",
      text: "To'langan",
    });
    expect(receiptAmountOf(order({ total_price: 0 }))).toEqual({
      kind: "label",
      text: "To'langan",
    });
  });

  it("reprint by status: returning orders → «Qaytarish», settled → «To'langan»", () => {
    for (const status of [
      "cancelled",
      "cancelled (sent)",
      "cancelled_sent",
      "returned_to_market",
      "canceled",
    ]) {
      expect(receiptAmountOf(order({ status })), status).toEqual({
        kind: "label",
        text: "Qaytarish",
      });
    }
    for (const status of ["sold", "paid", "partly_paid", "partly paid", "closed"]) {
      expect(receiptAmountOf(order({ status })), status).toEqual({
        kind: "label",
        text: "To'langan",
      });
    }
    for (const status of ["new", "received", "on the road", "waiting", null]) {
      expect(receiptAmountOf(order({ status }))?.kind, String(status)).toBe("collect");
    }
  });

  it("no money field (LOGIST projection) → no box", () => {
    expect(receiptAmountOf(order({ total_price: undefined }))).toBeNull();
    expect(receiptAmountOf(order({ total_price: null, status: "cancelled" }))).toBeNull();
    expect(receiptAmountOf(order({ total_price: "" }))).toBeNull();
  });
});

describe("receipt fields (TZ F3)", () => {
  it("maps the mockup sample 01", () => {
    expect(toReceiptOrderModel(RECEIPT_SAMPLES.main)).toEqual({
      id: "10241",
      ref: "№10241",
      qrToken: "a3f91c07be4d2e58f0c6a1d9",
      amount: { kind: "collect", value: "185 000", total: null },
      name: "Dilnoza Karimova",
      phone: "+998 90 123 45 67",
      extraPhone: "",
      region: "Samarqand · Urgut tumani",
      street: "Navoiy ko'chasi 14-uy, 3-xonadon, Urgut bozori yonida",
      delivery: "UYGACHA",
      date: "23.10.2026",
      products: ["Smart soat X8 Pro ×1", "Quvvatlagich 20W ×2"],
      comment: "Soat 18:00 dan keyin qo'ng'iroq qiling",
      sender: "Baraka Shop",
      contacts: ["+998 71 200 11 22"],
    });
  });

  it("number: full «№EL-…» (rwAy8Qyk), id only as a fallback (ega qarori 2)", () => {
    expect(toReceiptOrderModel(order({ order_number: "EL-100081" })).ref).toBe("№EL-100081");
    expect(toReceiptOrderModel(order({ order_number: "#EL-100081" })).ref).toBe("№EL-100081");
    expect(toReceiptOrderModel(order({ order_number: null })).ref).toBe("№81");
    expect(toReceiptOrderModel(order({ order_number: " " })).ref).toBe("№81");
  });

  it("QR carries only the token — never the id", () => {
    expect(
      toReceiptOrderModel(order({ qr_code_token: " 0123456789abcdef01234567 " })).qrToken,
    ).toBe("0123456789abcdef01234567");
    expect(toReceiptOrderModel(order({ qr_code_token: null })).qrToken).toBeNull();
    expect(toReceiptOrderModel(order({ qr_code_token: "" })).qrToken).toBeNull();
  });

  it("phones: v2 format, extra number (row first) under the main one, no duplicate", () => {
    const customer = { name: "Ali", phone_number: "901234567", extra_number: "+998 99 198-19-29" };
    expect(toReceiptOrderModel(order({ customer }))).toMatchObject({
      phone: "+998 90 123 45 67",
      extraPhone: "+998 99 198 19 29",
    });
    expect(toReceiptOrderModel(order({ customer, extra_number: "998971112233" })).extraPhone).toBe(
      "+998 97 111 22 33",
    );
    expect(
      toReceiptOrderModel(order({ customer: { ...customer, extra_number: "+998901234567" } }))
        .extraPhone,
    ).toBe("");
  });

  it("address: region (customer → order → district.region) · district; street from address, then customer.address", () => {
    expect(
      toReceiptOrderModel(
        order({
          district: { name: "Urgut tumani", region: { name: "Samarqand" } },
          customer: { address: "Navoiy 14" },
        }),
      ),
    ).toMatchObject({ region: "Samarqand · Urgut tumani", street: "Navoiy 14" });
    expect(
      toReceiptOrderModel(
        order({
          region: { name: "Toshkent sh." },
          customer: { region: { name: "Buxoro" }, district: { name: "Romitan" } },
        }),
      ).region,
    ).toBe("Buxoro · Romitan");
    expect(
      toReceiptOrderModel(order({ address: "Mustaqillik 27", customer: { address: "Eski" } }))
        .street,
    ).toBe("Mustaqillik 27");
    expect(
      toReceiptOrderModel(
        order({ region: { name: "Toshkent sh." }, district: { name: "Toshkent sh." } }),
      ).region,
    ).toBe("Toshkent sh.");
  });

  it("products: catalogue name → partner product_name → «Mahsulot», with «×quantity»", () => {
    const model = toReceiptOrderModel(
      order({
        items: [
          { quantity: 2, product: { name: "Samsung Galaxy A55" } },
          { quantity: 3, product: null, product_name: "Kabel USB-C" },
          { quantity: 1, product: null, product_name: null },
          { quantity: null, product: { name: "Sovg'a" } },
        ],
      }),
    );
    expect(model.products).toEqual([
      "Samsung Galaxy A55 ×2",
      "Kabel USB-C ×3",
      "Mahsulot ×1",
      "Sovg'a",
    ]);
  });

  it("delivery type and Tashkent date (UTC+5), independent of the browser zone", () => {
    expect(toReceiptOrderModel(order({ where_deliver: "center" })).delivery).toBe("MARKAZGACHA");
    expect(toReceiptOrderModel(order({ where_deliver: "address" })).delivery).toBe("UYGACHA");
    expect(formatReceiptDate("2026-10-22T20:30:00.000Z")).toBe("23.10.2026");
    expect(formatReceiptDate("2026-10-23T09:15:00.000Z", true)).toBe("23.10.2026, 14:15");
    expect(formatReceiptDate("noto'g'ri")).toBe("");
    expect(formatReceiptDate(null)).toBe("");
  });

  it("empty fields are empty strings — «-» / «—» are never produced", () => {
    const model = toReceiptOrderModel({
      id: "5",
      comment: "-",
      address: " — ",
      customer: { name: "  ", phone_number: null },
      market: { name: null, phone_number: null },
    });
    expect(model).toMatchObject({
      name: "",
      phone: "",
      extraPhone: "",
      region: "",
      street: "",
      comment: "",
      sender: "",
      contacts: [],
      products: [],
      date: "",
      amount: null,
    });
  });

  it("placeholder phones («-», «—», whitespace, «null») are empty: phone, extra number, «Muammo bo'lsa», number", () => {
    const model = toReceiptOrderModel({
      id: "6",
      order_number: "—",
      extra_number: "-",
      problem_contacts: [{ phone: "—" }, { phone: " - " }],
      customer: { name: "Dilnoza", phone_number: "-", extra_number: "—" },
      market: { name: "Baraka Shop", phone_number: "null" },
    });
    expect(model).toMatchObject({ ref: "№6", phone: "", extraPhone: "", contacts: [] });

    // Bo'sh joy tutuvchi qator raqami keyingi manbaga yo'l beradi: `extra_number` «-» → `customer.extra_number`.
    const fallback = toReceiptOrderModel({
      id: "7",
      extra_number: "–",
      problem_contacts: [{ phone: "-" }, { phone: "+998712001122" }],
      customer: { phone_number: " — ", extra_number: "998991981929" },
      market: { phone_number: "+998909998877" },
    });
    expect(fallback).toMatchObject({
      phone: "",
      extraPhone: "+998 99 198 19 29",
      contacts: ["+998 71 200 11 22"],
    });
  });
});

describe("receipt text: Cyrillic and Uzbek apostrophes (TZ F2)", () => {
  it("keeps Cyrillic as entered, maps ʻ ʼ to «'», drops invisible characters, unknown glyphs → «?»", () => {
    expect(normalizeReceiptText("Gʻulomov Oʼktam")).toBe("G'ulomov O'ktam");
    expect(normalizeReceiptText("Қўчқорова\u00a0 Ғулом\nҲасанович")).toBe(
      "Қўчқорова Ғулом Ҳасанович",
    );
    expect(normalizeReceiptText("Dilnoza 🌸\u200b Karimova")).toBe("Dilnoza Karimova");
    expect(normalizeReceiptText("名前 Ali")).toBe("?? Ali");
    expect(normalizeReceiptText(null)).toBe("");
    expect(toReceiptOrderModel(order({ customer: { name: "Қўчқорова Ғулом" } })).name).toBe(
      "Қўчқорова Ғулом",
    );
  });

  it("draws қ ғ ҳ Қ Ғ Ҳ from the Noto Sans subset, the rest from Manrope (600 → Noto 700)", () => {
    expect(splitFaceRuns("Қўчқор", 700)).toEqual([
      { face: "noto-700", text: "Қ" },
      { face: "manrope-700", text: "ўч" },
      { face: "noto-700", text: "қ" },
      { face: "manrope-700", text: "ор" },
    ]);
    expect(splitFaceRuns("ғ", 500)).toEqual([{ face: "noto-500", text: "ғ" }]);
    expect(splitFaceRuns("ҳ", 600)).toEqual([{ face: "noto-700", text: "ҳ" }]);
  });
});
