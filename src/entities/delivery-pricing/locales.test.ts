import { describe, expect, it } from "vitest";
import uz from "../../locales/uz/deliveryPricing.json";
import ru from "../../locales/ru/deliveryPricing.json";
import en from "../../locales/en/deliveryPricing.json";

const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

const placeholders = (dict: unknown) =>
  Object.fromEntries(
    flatten(dict).map((key) => {
      const text = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dict);
      return [key, [...String(text).matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort()];
    }),
  );

describe("deliveryPricing — uz/ru/en", () => {
  it("uchala tilda bir xil kalitlar, bo'sh matn yo'q", () => {
    expect(flatten(ru).sort()).toEqual(flatten(uz).sort());
    expect(flatten(en).sort()).toEqual(flatten(uz).sort());
    for (const dict of [uz, ru, en]) {
      expect(Object.values(placeholders(dict)).length).toBeGreaterThan(0);
    }
  });

  it("o'rinbosarlar ({{billable}} …) har tilda bir xil", () => {
    expect(placeholders(ru)).toEqual(placeholders(uz));
    expect(placeholders(en)).toEqual(placeholders(uz));
  });

  it("o'zbekcha matn maketdagidek", () => {
    expect(uz.tariffs).toEqual({ city: "Shahar ichida", center: "Markazgacha", address: "Uygacha" });
    expect(uz.volumetric.label).toBe("Hajmga qarab hisoblash");
    expect(uz.weights.invalidTitle).toBe("Hisoblab bo'lmadi");
    expect(uz.quote.title).toBe("Taxminiy yetkazish narxi");
    expect(uz.quote.failed).toBe("Narxni hisoblab bo'lmadi");
  });
});
