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

/**
 * Jadval backend speci bilan bir xil (`order-service.external-import.spec.ts`, «NARX»): ro'yxatda ko'ringan summa
 * yaratiladigan buyurtmaniki bo'lsin, backend rad etadigani esa `null` («—»).
 */
describe("readAmount — backend import narxi kabi", () => {
  it.each([
    [undefined, 0],
    [null, 0],
    ["", 0],
    ["   ", 0],
    [150000, 150000],
    ["150000", 150000],
    ["150000.50", 150000.5],
    [-5, 0],
  ])("son: %j → %j", (value, expected) => {
    expect(readAmount(value)).toBe(expected);
  });

  it.each([
    ["150 000", 150000],
    ["99 000", 99000],
    ["1 500 000", 1500000],
    [" 150 000 ", 150000],
    ["150\u00a0000", 150000],
    ["150\u202f000", 150000],
    ["150\u2009000", 150000],
    ["999 999 999 999", 999999999999],
  ])("⭐ minglik bo'shlig'i (ega qarori 2026-11-25): %j → %j", (value, expected) => {
    expect(readAmount(value)).toBe(expected);
  });

  it.each([
    "tekin",
    "150 000 so'm",
    "99,000",
    "1,500,000",
    "150,5",
    "12,5",
    "150 000,50",
    "150 000.50",
    "15 0",
    "1500 000",
    "150 00",
    "150  000",
    "0 150",
    "-150 000",
    "1 000 000 000 000",
    NaN,
  ])("⭐ backend rad etadi (price_invalid) — null: %j", (value) => {
    expect(readAmount(value)).toBeNull();
  });

  it("son ham, matn ham emas — null (backend kabi)", () => {
    expect(readAmount(["150 000"])).toBeNull();
    expect(readAmount([5])).toBeNull();
    expect(readAmount(true)).toBeNull();
    expect(readAmount({})).toBeNull();
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

describe("mahsulotlar — massiv (backend external-item-limits nusxasi)", () => {
  const items = (raw: unknown) =>
    toSitePreview({ id: 1, phone: "901234567", items: raw }, DEFAULT_SITE_MAPPING, "Q").items;

  it.each([1.5, "2.5", 0.4, 2_147_483_648, "4780012345678", 1e300, -5, "salom"])(
    "⭐ son musbat butun emas yoki int4 ga sig'maydi (%j) — 1",
    (quantity) => {
      expect(items([{ name: "Gilam", quantity }])).toEqual([{ name: "Gilam", quantity: 1 }]);
    },
  );

  it("⭐ nom 255 belgiga kesiladi, emoji yarmidan bo'linmaydi", () => {
    expect(items([{ name: `${"a".repeat(255)}ortiqcha`, quantity: 3 }])).toEqual([
      { name: "a".repeat(255), quantity: 3 },
    ]);
    expect(items([{ name: `${"a".repeat(254)}🎁🎁` }])[0].name).toBe(`${"a".repeat(254)}🎁`);
  });

  it("⭐ sonlar yig'indisi int4 dan oshmaydi", () => {
    const rows = items([
      { name: "A", quantity: 2_000_000_000 },
      { name: "B", quantity: 2_000_000_000 },
      { name: "C", quantity: 5 },
    ]);
    expect(rows.map((row) => row.quantity)).toEqual([2_000_000_000, 1, 5]);
  });

  it("sig'adigan qator o'zgarmaydi", () => {
    expect(items([{ name: "  Soat  qora ", quantity: "2" }, { name: "B" }])).toEqual([
      { name: "Soat  qora", quantity: 2 },
      { name: "B", quantity: 1 },
    ]);
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
