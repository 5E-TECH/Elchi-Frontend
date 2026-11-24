import { describe, expect, it } from "vitest";
import {
  DEFAULT_QR_SEARCH_ENDPOINT,
  DEFAULT_SITE_MAPPING,
  EXISTING_SKIP_REASONS,
  knownSkipReason,
  previewsTotal,
  qrSearchEndpoint,
  readAmount,
  readPath,
  readSiteMapping,
  toSitePreview,
  unwrapSiteOrders,
  withPath,
} from "./siteOrder";

const adoshOrder = {
  id: 501,
  qr_code: "ADQ-000501",
  full_name: "Rustam Jo'rayev",
  phone: "+998901234567",
  address: "Toshkent, Chilonzor 9",
  comment: "Qo'ng'iroq qiling",
  total_price: "150 000",
  delivery_price: 20000,
  items: [
    { name: "Ko'ylak", quantity: 2 },
    { name: "Shim", quantity: "1" },
    { name: "", quantity: 3 },
  ],
};

describe("readSiteMapping — ulanishning field_mapping i", () => {
  it("bo'sh yoki noto'g'ri qiymatda backend sukutlari", () => {
    expect(readSiteMapping(undefined)).toEqual(DEFAULT_SITE_MAPPING);
    expect(readSiteMapping("text")).toEqual(DEFAULT_SITE_MAPPING);
    expect(readSiteMapping({ phone_field: "  ", id_field: 5 })).toEqual(DEFAULT_SITE_MAPPING);
  });

  it("berilgan maydonlar sukutni almashtiradi (bo'shliqlar kesiladi)", () => {
    const mapping = readSiteMapping({ phone_field: " customer.phone ", customer_name_field: "customer.name" });
    expect(mapping.phone_field).toBe("customer.phone");
    expect(mapping.customer_name_field).toBe("customer.name");
    expect(mapping.id_field).toBe("id");
  });
});

describe("readPath / withPath — nuqtali yo'l", () => {
  it("chuqur qiymatni o'qiydi, yo'q bo'lsa undefined", () => {
    expect(readPath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
    expect(readPath({ a: [1] }, "a.0")).toBeUndefined();
    expect(readPath(null, "a")).toBeUndefined();
  });

  it("asl obyektni o'zgartirmay nusxaga yozadi, oraliq obyektlarni yaratadi", () => {
    const source = { a: { x: 1 } };
    const next = withPath(source, "a.b.c", "QR");
    expect(next).toEqual({ a: { x: 1, b: { c: "QR" } } });
    expect(source).toEqual({ a: { x: 1 } });
  });
});

describe("readAmount — backend safeExternalAmount kabi", () => {
  it.each([
    [undefined, 0],
    ["", 0],
    [150000, 150000],
    ["150 000", 150000],
    ["12,5", 12.5],
    [-5, 0],
    ["abc", null],
  ])("%s → %s", (value, expected) => {
    expect(readAmount(value)).toBe(expected);
  });
});

describe("unwrapSiteOrders — sayt javobidan buyurtma(lar)", () => {
  it("topilmadi: null, bo'sh massiv, success:false", () => {
    expect(unwrapSiteOrders(null, DEFAULT_SITE_MAPPING)).toEqual([]);
    expect(unwrapSiteOrders([], DEFAULT_SITE_MAPPING)).toEqual([]);
    expect(unwrapSiteOrders({ success: false, message: "not found" }, DEFAULT_SITE_MAPPING)).toEqual([]);
    expect(unwrapSiteOrders({}, DEFAULT_SITE_MAPPING)).toEqual([]);
  });

  it("buyurtmaning o'zi yoki saytning qobig'i ({ success, data }) — BeePost kabi ochiladi", () => {
    expect(unwrapSiteOrders(adoshOrder, DEFAULT_SITE_MAPPING)).toEqual([adoshOrder]);
    expect(unwrapSiteOrders({ success: true, data: adoshOrder }, DEFAULT_SITE_MAPPING)).toEqual([adoshOrder]);
    expect(unwrapSiteOrders({ data: { data: [adoshOrder] } }, DEFAULT_SITE_MAPPING)).toEqual([adoshOrder]);
  });

  it("massivdagi yozuv bo'lmagan elementlar tashlanadi", () => {
    expect(unwrapSiteOrders([adoshOrder, 5, null], DEFAULT_SITE_MAPPING)).toEqual([adoshOrder]);
  });
});

describe("toSitePreview — ro'yxat qatori", () => {
  it("xaritadagi maydonlar va summa (narx + yetkazish); nomsiz mahsulot tashlanadi", () => {
    const row = toSitePreview(adoshOrder, DEFAULT_SITE_MAPPING, "SCANNED");
    expect(row).toMatchObject({
      key: "ADQ-000501",
      qr: "ADQ-000501",
      externalId: "501",
      name: "Rustam Jo'rayev",
      phone: "+998901234567",
      address: "Toshkent, Chilonzor 9",
      comment: "Qo'ng'iroq qiling",
      amount: 170000,
      items: [
        { name: "Ko'ylak", quantity: 2 },
        { name: "Shim", quantity: 1 },
      ],
    });
    // Saytning o'z QR'i bor — yuboriladigan buyurtma o'zgarmaydi.
    expect(row.payload).toBe(adoshOrder);
  });

  it("⭐ saytda QR maydoni yo'q — skanerlangan QR qatorga ham, yuboriladigan buyurtmaga ham yoziladi", () => {
    const raw = { id: 7, phone: "901234567" };
    const row = toSitePreview(raw, DEFAULT_SITE_MAPPING, " QR-77 ");
    expect(row.qr).toBe("QR-77");
    expect(row.payload).toEqual({ id: 7, phone: "901234567", qr_code: "QR-77" });
    expect(raw).toEqual({ id: 7, phone: "901234567" });
  });

  it("nuqtali QR maydoni — ichki obyektga yoziladi", () => {
    const mapping = readSiteMapping({ qr_code_field: "parcel.qr" });
    const row = toSitePreview({ id: 1, parcel: { weight: 2 } }, mapping, "P-1");
    expect(row.payload).toEqual({ id: 1, parcel: { weight: 2, qr: "P-1" } });
  });

  it("summa o'qilmasa — null (backend price_invalid), yig'indida 0", () => {
    const row = toSitePreview({ id: 2, total_price: "bepul" }, DEFAULT_SITE_MAPPING, "Q2");
    expect(row.amount).toBeNull();
    expect(row.externalId).toBe("2");
    expect(previewsTotal([row, toSitePreview(adoshOrder, DEFAULT_SITE_MAPPING, "x")])).toBe(170000);
  });
});

describe("mahsulotlar — items matn bo'lib kelganda (backend readExternalItemsText nusxasi)", () => {
  const items = (raw: Record<string, unknown>, mapping = DEFAULT_SITE_MAPPING) =>
    toSitePreview({ id: 1, phone: "901234567", ...raw }, mapping, "Q").items;

  it("⭐ Lidershop / Alion: nom va son matndan, summa esa maydonlardan", () => {
    const row = toSitePreview(
      { id: 1, items: "Diskali soat x 1 = 99 000 so'm", total_count: 1, total_price: 150000, delivery_price: 30000 },
      DEFAULT_SITE_MAPPING,
      "Q",
    );
    expect(row.items).toEqual([{ name: "Diskali soat", quantity: 1 }]);
    expect(row.amount).toBe(180000);
  });

  it("ajralmasa — butun matn bitta qator, soni total_count_field dan", () => {
    expect(items({ items: "salom", total_count: "3" })).toEqual([{ name: "salom", quantity: 3 }]);
    expect(items({ items: "salom" })).toEqual([{ name: "salom", quantity: 1 }]);
    const mapping = readSiteMapping({ items_field: "order.goods", total_count_field: "order.count" });
    expect(items({ items: "boshqa", order: { goods: "salom", count: 4 } }, mapping)).toEqual([
      { name: "salom", quantity: 4 },
    ]);
  });

  it.each([undefined, null, 5, true, { name: "Telefon" }, "", "  "])("massiv ham, matn ham emas (%j) — bo'sh", (raw) => {
    expect(items({ items: raw, total_count: 2 })).toEqual([]);
  });
});

describe("qrSearchEndpoint — search-by-qr ga endpoint", () => {
  it("ulanishda qidiruv sozlangan — yuborilmaydi (backend o'zinikini oladi)", () => {
    expect(
      qrSearchEndpoint({ api_url: "https://adosh.uz/api", status_sync_config: { external_search: { endpoint: "/find" } } }),
    ).toBeUndefined();
  });

  it("sozlanmagan — BeePost odati /qrorder/find", () => {
    expect(qrSearchEndpoint({ api_url: "https://adosh.uz/api" })).toBe(DEFAULT_QR_SEARCH_ENDPOINT);
    expect(qrSearchEndpoint({ api_url: "https://adosh.uz/api", status_sync_config: { external_search: {} } })).toBe(
      DEFAULT_QR_SEARCH_ENDPOINT,
    );
  });

  it("API manzilining o'zi /qrorder/find bilan tugasa — to'liq manzil (yo'l ikki marta qo'shilmasin)", () => {
    expect(qrSearchEndpoint({ api_url: "https://x.uz/api/qrorder/find", base_url: null })).toBe(
      "https://x.uz/api/qrorder/find",
    );
  });
});

describe("qabul sabablari", () => {
  it("bor buyurtma xato emas — qabul baribir so'raladi", () => {
    expect(EXISTING_SKIP_REASONS).toEqual(["already_exists", "qr_code_conflict"]);
  });

  it("ma'lum sabab — i18n kaliti, noma'lumi — null", () => {
    expect(knownSkipReason("phone_missing")).toBe("phone_missing");
    expect(knownSkipReason("district_unresolved")).toBe("district_unresolved");
    expect(knownSkipReason("something_new")).toBeNull();
  });
});
