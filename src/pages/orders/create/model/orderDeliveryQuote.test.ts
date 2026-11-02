import { describe, expect, it } from "vitest";
import type { DeliveryQuote } from "../../../../entities/delivery-pricing";
import {
  buildOrderQuoteInput,
  estimateTotal,
  MAX_QUOTE_UNITS_PER_ITEM,
  quoteForDeliveryType,
  readCatalogMeasure,
} from "./orderDeliveryQuote";
import type { CatalogProduct } from "./orderPricing";

/** 6NYcXvGy — buyurtma formasida taxminiy yetkazish narxi: so'rov elementlari va tarif tanlash. */

const MEASURED: CatalogProduct = {
  id: 501,
  name: "Telefon ushlagich",
  weight_kg: "1.2",
  length_cm: 30,
  width_cm: "22",
  height_cm: 15,
  volumetric_enabled: true,
};
const NO_VOLUME: CatalogProduct = {
  id: 502,
  weight_kg: 2,
  length_cm: 10,
  width_cm: 10,
  height_cm: 10,
  volumetric_enabled: false,
};
const UNMEASURED: CatalogProduct = { id: 503, name: "Eski mahsulot", weight_kg: null };

const catalog = new Map<string, CatalogProduct>(
  [MEASURED, NO_VOLUME, UNMEASURED].map((item) => [String(item.id), item]),
);
const findProduct = (id: string) => catalog.get(id);

const quote = (tariffId: DeliveryQuote["tariffId"], total: number): DeliveryQuote => ({
  tariffId,
  base: 35_000,
  perExtraKg: 4_000,
  actualKg: 1.2,
  volumetricKg: 1.98,
  billableKg: 2,
  extraKg: 1,
  extra: 4_000,
  total,
  basis: "volume",
  volumetricFromKg: 0,
  volumetricApplied: true,
  daysMin: 1,
  daysMax: 2,
});

describe("readCatalogMeasure", () => {
  it("og'irlik va uchala o'lcham bor — so'rov elementi (satr sonlar ham), hajm kaliti sukut bo'yicha yoqiq", () => {
    expect(readCatalogMeasure(MEASURED)).toEqual({
      weight_kg: 1.2,
      length_cm: 30,
      width_cm: 22,
      height_cm: 15,
      volumetric_enabled: true,
    });
    expect(
      readCatalogMeasure({ ...MEASURED, volumetric_enabled: undefined })?.volumetric_enabled,
    ).toBe(true);
    expect(readCatalogMeasure(NO_VOLUME)?.volumetric_enabled).toBe(false);
  });

  it("biror o'lchov yo'q, 0 yoki noto'g'ri — o'lchovsiz (`null`)", () => {
    expect(readCatalogMeasure(UNMEASURED)).toBeNull();
    expect(readCatalogMeasure({ ...MEASURED, height_cm: null })).toBeNull();
    expect(readCatalogMeasure({ ...MEASURED, weight_kg: 0 })).toBeNull();
    expect(readCatalogMeasure({ ...MEASURED, length_cm: "abc" })).toBeNull();
    expect(readCatalogMeasure(undefined)).toBeNull();
  });
});

describe("buildOrderQuoteInput", () => {
  it("har dona — alohida element; o'lchovsiz va katalogdan tashqari qatorlar sanaladi, so'rovga kirmaydi", () => {
    const input = buildOrderQuoteInput(
      [
        { product_id: "501", quantity: 2 },
        { product_id: "502", quantity: 1 },
        { product_id: "503", quantity: 4 },
        { product_id: null, product_name: "Katalogdan tashqari", quantity: 1 },
      ],
      findProduct,
    );
    expect(input.measured).toBe(2);
    expect(input.unmeasured).toBe(2);
    expect(input.items).toHaveLength(3);
    expect(input.items.filter((item) => item.weight_kg === 1.2)).toHaveLength(2);
    expect(input.items.filter((item) => item.volumetric_enabled === false)).toHaveLength(1);
    // Maket: o'lchovsiz mahsulot nomi bilan aytiladi («Sovg'a qadog'i» katalogda yo'q — …).
    expect(input.catalogLessNames).toEqual(["Katalogdan tashqari"]);
    expect(input.unmeasuredNames).toEqual(["Eski mahsulot"]);
  });

  it("noto'g'ri yoki kasr son — kamida 1 dona, butun qismi", () => {
    expect(
      buildOrderQuoteInput([{ product_id: "501", quantity: 0 }], findProduct).items,
    ).toHaveLength(1);
    expect(
      buildOrderQuoteInput([{ product_id: "501", quantity: 2.7 }], findProduct).items,
    ).toHaveLength(2);
  });

  it("cheksiz yoki juda katta son so'rovni osiltirmaydi — bir qatorda ko'pi bilan MAX_QUOTE_UNITS_PER_ITEM", () => {
    expect(
      buildOrderQuoteInput([{ product_id: "501", quantity: Infinity }], findProduct).items,
    ).toHaveLength(1);
    expect(
      buildOrderQuoteInput([{ product_id: "501", quantity: 10_000 }], findProduct).items,
    ).toHaveLength(MAX_QUOTE_UNITS_PER_ITEM);
  });

  it("mahsulot yo'q — so'rov ham yo'q", () => {
    expect(buildOrderQuoteInput([], findProduct)).toEqual({
      items: [],
      measured: 0,
      unmeasured: 0,
      catalogLessNames: [],
      unmeasuredNames: [],
    });
  });
});

describe("quoteForDeliveryType", () => {
  const quotes = {
    city: quote("city", 30_000),
    center: quote("center", 39_000),
    address: quote("address", 43_000),
  };

  it("«Markazgacha» — center, «Uygacha» — address (shahar tarifi tanlanmaydi)", () => {
    expect(quoteForDeliveryType(quotes, "center")?.total).toBe(39_000);
    expect(quoteForDeliveryType(quotes, "address")?.total).toBe(43_000);
  });

  it("javob yo'q yoki bu turga faol tarif yo'q — `null`", () => {
    expect(quoteForDeliveryType(undefined, "address")).toBeNull();
    expect(quoteForDeliveryType({ ...quotes, address: null }, "address")).toBeNull();
  });
});

describe("estimateTotal — maket: market standart narxi + vazn uchun qo'shimcha", () => {
  it("server `total` (umumiy tarif asosi) emas — standart narx + `extra`", () => {
    const address = { ...quote("address", 64_000), base: 60_000, extra: 4_000 };
    expect(estimateTotal(35_000, address)).toBe(39_000);
    expect(estimateTotal(35_000, { ...address, extra: 0 })).toBe(35_000);
  });
});
