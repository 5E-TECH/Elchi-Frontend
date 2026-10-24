import { describe, expect, it } from "vitest";
import uz from "../../../locales/uz/products.json";
import ru from "../../../locales/ru/products.json";
import en from "../../../locales/en/products.json";

/** 6FLyjO6j: `products.json` uchala tilda — unutilgan kalit jim ketmasin (avval parity testi yo'q edi). */
const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix.replace(/_(zero|one|two|few|many|other)$/, "")];
const keysOf = (dict: unknown) => [...new Set(flatten(dict))].sort();

describe("products — uz/ru/en", () => {
  it("ru va en da uz dagi barcha kalitlar bor (va ortiqchasi yo'q)", () => {
    expect(keysOf(ru)).toEqual(keysOf(uz));
    expect(keysOf(en)).toEqual(keysOf(uz));
  });

  it("o'lchov matnlari maketdagidek (uz)", () => {
    expect(uz.v2.measure.title).toBe("Og'irlik va o'lcham");
    expect(uz.v2.measure.dimensions).toBe("O'lcham (U × K × B)");
    expect(uz.v2.measure.errors.weightRequired).toBe("Og'irlikni kiriting — kamida 0,1 kg");
    expect(uz.v2.measure.errors.notNumber).toBe("Faqat raqam kiriting");
    expect(uz.v2.measure.errors.dimensionInteger).toBe("Musbat butun son kiriting");
    expect(uz.v2.measure.notEntered).toBe("Kiritilmagan");
    expect(uz.v2.list.columns).toMatchObject({ weight: "Og'irlik", dimensions: "O'lcham, sm", billable: "Hisob vazni" });
  });
});
