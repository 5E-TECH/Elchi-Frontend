import { describe, expect, it } from "vitest";
import {
  canSeeMarketTariffs,
  computeItemsTotal,
  hasNoTariffs,
  hasTariffFields,
  readDeliveryType,
  readMarketTariffs,
  readProductPrice,
  readTariff,
  suggestedTotalDigits,
  tariffFor,
  type CatalogProduct,
} from "./orderPricing";

describe("orderPricing — standart narx (CS-B)", () => {
  it("narxni faqat superadmin, admin va market ko'radi (menejer/registratorga backend bermaydi — N3)", () => {
    expect(["superadmin", "admin", "market"].every(canSeeMarketTariffs)).toBe(true);
    expect(["manager", "registrator", "courier", "market_operator", null, undefined].some(canSeeMarketTariffs)).toBe(false);
  });

  it("tarif: musbat butun so'm; `null`, bo'sh, 0, manfiy va noto'g'ri — belgilanmagan", () => {
    expect(readTariff(35000)).toBe(35000);
    expect(readTariff("25000")).toBe(25000);
    expect(readTariff(null)).toBeNull();
    expect(readTariff(undefined)).toBeNull();
    expect(readTariff("")).toBeNull();
    expect(readTariff(0)).toBeNull();
    expect(readTariff(-5)).toBeNull();
    expect(readTariff("abc")).toBeNull();
  });

  it("`default_tariff`: backend `address` | `center`, eski `home` → `address`, boshqasi — `null`", () => {
    expect(readDeliveryType("address")).toBe("address");
    expect(readDeliveryType("home")).toBe("address");
    expect(readDeliveryType("center")).toBe("center");
    expect(readDeliveryType(null)).toBeNull();
    expect(readDeliveryType("pickup")).toBeNull();
  });

  it("market yozuvi va gateway qobig'i (`GET users/:id`) dan tariflar", () => {
    const row = { id: 3, tariff_home: 35000, tariff_center: null, default_tariff: "center" };
    expect(hasTariffFields(row)).toBe(true);
    expect(hasTariffFields({ id: 3, name: "Baraka" })).toBe(false);
    expect(readMarketTariffs(row)).toEqual({ address: 35000, center: null, defaultType: "center" });
    expect(readMarketTariffs({ statusCode: 200, data: row })).toEqual({ address: 35000, center: null, defaultType: "center" });
    expect(readMarketTariffs(null)).toBeNull();
  });

  it("tur bo'yicha narx va «ikkalasi ham yo'q» holati", () => {
    const tariffs = { address: 35000, center: null, defaultType: null };
    expect(tariffFor(tariffs, "address")).toBe(35000);
    expect(tariffFor(tariffs, "center")).toBeNull();
    expect(tariffFor(null, "address")).toBeNull();
    expect(hasNoTariffs(tariffs)).toBe(false);
    expect(hasNoTariffs({ address: null, center: null, defaultType: "address" })).toBe(true);
    expect(hasNoTariffs(null)).toBe(false);
  });
});

describe("orderPricing — mahsulot narxi va summa taklifi (CS-B)", () => {
  const catalog: Record<string, CatalogProduct> = {
    "1": { id: 1, name: "Quloqchin", price: "185000.00" },
    "2": { id: 2, name: "G'ilof", price: 45000 },
    "3": { id: 3, name: "Kabel", price: null },
    "4": { id: 4, name: "Sovg'a", price: 0 },
  };
  const find = (id: string) => catalog[id];

  it("mahsulot narxi: `numeric(14,2)` satri ham son; bo'sh / noto'g'ri — `null`; 0 — haqiqiy narx", () => {
    expect(readProductPrice(catalog["1"])).toBe(185000);
    expect(readProductPrice(catalog["3"])).toBeNull();
    expect(readProductPrice({ id: 9, price: " " })).toBeNull();
    expect(readProductPrice({ id: 9, price: "-1" })).toBeNull();
    expect(readProductPrice(catalog["4"])).toBe(0);
    expect(readProductPrice(undefined)).toBeNull();
  });

  it("Σ narx × son; narxsiz katalog mahsuloti, katalogdan tashqari va yuklanmagan mahsulot hisobga kirmaydi", () => {
    const result = computeItemsTotal(
      [
        { product_id: "1", quantity: 1 },
        { product_id: "2", quantity: 2 },
        { product_id: "3", quantity: 1 },
        { product_id: null, product_name: "Sovg'a qadog'i", quantity: 1 },
        { product_id: "99", quantity: 1 },
      ],
      find,
    );
    expect(result).toEqual({ total: 275000, priced: 2, unpriced: 3 });
    expect(suggestedTotalDigits(result)).toBe("275000");
  });

  it("hisobga kirgan mahsulot yo'q — taklif bo'sh; bepul mahsulot — «0»", () => {
    expect(suggestedTotalDigits(computeItemsTotal([{ product_id: "3", quantity: 1 }], find))).toBe("");
    expect(suggestedTotalDigits(computeItemsTotal([], find))).toBe("");
    expect(suggestedTotalDigits(computeItemsTotal([{ product_id: "4", quantity: 3 }], find))).toBe("0");
  });
});
