import { describe, expect, it } from "vitest";
import uz from "../../locales/uz/common.json";
import ru from "../../locales/ru/common.json";
import en from "../../locales/en/common.json";
import { COVERAGE_REASONS } from "./coverageReasons";

/**
 * FILIAL QAMROVI MATNLARI (`common:coverage.*`). Kalit faqat `uz` ga qo'shilsa, ru/en da jim o'zbekcha matn
 * chiqadi — uchala tilda bir xil kalitlar va bir xil o'rinbosarlar qulflanadi.
 */
type Block = Record<string, Record<string, string> | string>;
const UZ = uz.coverage as Block;
const RU = ru.coverage as Block;
const EN = en.coverage as Block;

const flatten = (block: Block) =>
  Object.entries(block).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, value] as const] : Object.entries(value).map(([sub, text]) => [`${key}.${sub}`, text] as const),
  );

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

describe("common.coverage locales", () => {
  it("har sabab kodida sarlavha bor, uchala tilda kalitlar bir xil", () => {
    for (const reason of COVERAGE_REASONS) {
      expect((UZ[reason] as Record<string, string>)?.title, `uz.${reason}.title`).toBeTruthy();
    }
    const keys = flatten(UZ).map(([key]) => key).sort();
    expect(flatten(RU).map(([key]) => key).sort()).toEqual(keys);
    expect(flatten(EN).map(([key]) => key).sort()).toEqual(keys);
  });

  it("bo'sh matn yo'q, ru — kirillcha, uz — inglizcha so'zsiz", () => {
    for (const [key, text] of flatten(RU)) expect(text, `ru.${key}`).toMatch(/[А-Яа-яЁё]/);
    for (const [key, text] of flatten(EN)) expect(text.trim(), `en.${key}`).toBeTruthy();
    for (const [key, text] of flatten(UZ)) {
      expect(text.trim(), `uz.${key}`).toBeTruthy();
      expect(text, `uz.${key}`).not.toMatch(/\b(the|order|branch|courier|region|mail|post|error|not)\b/i);
      // Backend matnidagi texnik qismlar foydalanuvchiga chiqmaydi.
      expect(text, `uz.${key}`).not.toMatch(/\/district\/|hudud #|#\d/);
    }
  });

  it("o'rinbosarlar uchala tilda bir xil", () => {
    const ruMap = new Map(flatten(RU));
    const enMap = new Map(flatten(EN));
    for (const [key, text] of flatten(UZ)) {
      expect(placeholders(ruMap.get(key) ?? ""), `ru.${key}`).toEqual(placeholders(text));
      expect(placeholders(enMap.get(key) ?? ""), `en.${key}`).toEqual(placeholders(text));
    }
  });

  it("ega tasdiqlagan o'zbekcha matnlar", () => {
    const text = (key: string) => new Map(flatten(UZ)).get(key);
    expect(text("district_not_served_by_branch.title")).toBe("Boshqa viloyat buyurtmasi");
    expect(text("order_not_in_your_branch.title")).toBe("Bu buyurtma sizning filialingizda emas");
    expect(text("post_receive_manager_only.text")).toBe("Bu pochtani faqat manzil filial menejeri qabul qila oladi.");
    expect(text("idsMore")).toBe("{{ids}} va yana {{count}} ta");
  });
});
