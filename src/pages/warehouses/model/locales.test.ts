import { describe, expect, it } from "vitest";
import uz from "../../../locales/uz/warehouses.json";
import ru from "../../../locales/ru/warehouses.json";
import en from "../../../locales/en/warehouses.json";

const flattenRaw = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flattenRaw(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];
/** Ko'plik qo'shimchalari (_one, _few …) tilga qarab farq qiladi — asosiy kalit bo'yicha solishtiriladi. */
const flatten = (value: unknown) => [
  ...new Set(flattenRaw(value).map((key) => key.replace(/_(zero|one|two|few|many|other)$/, ""))),
];
const valueAt = (dict: unknown, key: string) =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dict);

const placeholders = (dict: unknown) =>
  Object.fromEntries(
    flattenRaw(dict)
      .filter((key) => !/_(zero|one|two|few|many|other)$/.test(key) || key.endsWith("_other"))
      .map((key) => [key, [...String(valueAt(dict, key)).matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort()]),
  );

describe("warehouses — uz/ru/en", () => {
  it("uchala tilda bir xil kalitlar, bo'sh matn yo'q", () => {
    expect(flatten(ru).sort()).toEqual(flatten(uz).sort());
    expect(flatten(en).sort()).toEqual(flatten(uz).sort());
    for (const dict of [uz, ru, en]) {
      for (const key of flattenRaw(dict)) expect(String(valueAt(dict, key)).trim(), key).not.toBe("");
    }
  });

  it("o'rinbosarlar har tilda bir xil", () => {
    expect(placeholders(ru)).toEqual(placeholders(uz));
    expect(placeholders(en)).toEqual(placeholders(uz));
  });

  it("o'zbekcha matn maketdagidek", () => {
    expect(uz.list.title).toBe("Omborlar");
    // Pa1KaXmj: ro'yxatda Markaziy ombor ham bor — maketdagi «Viloyat filiallaridagi omborlar …» va «… faqat ombori yo'q
    // viloyat filiallari» kengaytirildi (maket yo'q — eng yaqini superadmin-warehouse-list / -create-dialog).
    expect(uz.list.description).toBe("Markaziy va viloyat omborlari: qoldiq, band va harakatlar");
    expect(uz.create.title).toBe("Ombor ochish");
    expect(uz.create.branchHint).toBe("Ro'yxatda faqat ombori yo'q filiallar: HQ (markaziy ombor) va viloyat filiallari");
    expect(uz.stockIn.title).toBe("Omborga mahsulot qo'shish");
    expect(uz.stockIn.description).toBe("Kirim — mahsulot darhol qoldiqqa qo'shiladi");
    expect(uz.stockIn.usbReady).toBe("USB skaner tayyor");
    expect(uz.detail.menu.inventoryHint).toBe("Haqiqiy sonni kiritib, farqni tuzatish");
    expect(uz.manager.noteTitle).toBe("Qoldiqni admin boshqaradi");
    expect(uz.level).toEqual({ ok: "Yetarli", low: "Kam qoldi", out: "Tugagan" });
  });

  it("Pa1KaXmj: atama «Markaziy ombor» (ru «Центральный склад», en «Central warehouse»); «HQ ombori» yo'q", () => {
    expect(uz.kind.hqWarehouse).toBe("Markaziy ombor");
    expect(ru.kind.hqWarehouse).toBe("Центральный склад");
    expect(en.kind.hqWarehouse).toBe("Central warehouse");
    expect(uz.create.hqManagerHint).toBe("Markaziy omborda menejer yo'q — mas'ul belgilanmaydi");
    // «HQ ombori» — bekor posilkaning HQ'ga jismoniy qaytishi uchun band ibora (newOrders, ops).
    for (const key of flattenRaw(uz)) expect(String(valueAt(uz, key)), key).not.toMatch(/HQ ombori/i);
  });
});
