import { createInstance } from "i18next";
import uz from "../../../locales/uz/courierBulk.json";
import ru from "../../../locales/ru/courierBulk.json";
import en from "../../../locales/en/courierBulk.json";

/** «Tezkor amal» matnlari: uchala tilda bir xil kalitlar, en/ru ko'plik shakllari. */
const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

const baseKeys = (locale: unknown) =>
  new Set(flatten(locale).map((key) => key.replace(/_(zero|one|two|few|many|other)$/, "")));

const translator = async (lng: "uz" | "ru" | "en") => {
  const i18n = createInstance();
  await i18n.init({
    lng,
    fallbackLng: "uz",
    ns: ["courierBulk"],
    defaultNS: "courierBulk",
    resources: { uz: { courierBulk: uz }, ru: { courierBulk: ru }, en: { courierBulk: en } },
    interpolation: { escapeValue: false },
  });
  return i18n.t.bind(i18n);
};

describe("courierBulk locale", () => {
  it.each([
    ["ru", ru],
    ["en", en],
  ])("%s has the same keys as uz", (_, locale) => {
    expect([...baseKeys(locale)].sort()).toEqual([...baseKeys(uz)].sort());
  });

  it("ru/en plural keys always include the `_other` form", () => {
    for (const locale of [ru, en]) {
      const keys = flatten(locale);
      for (const key of keys.filter((item) => /_(one|few|many)$/.test(item))) {
        expect(keys).toContain(key.replace(/_(one|few|many)$/, "_other"));
      }
    }
  });

  it("en: singular and plural order counts", async () => {
    const t = await translator("en");
    expect(t("confirmDescription", { count: 1 })).toBe("1 order: the following will happen");
    expect(t("confirmDescription", { count: 4 })).toBe("4 orders: the following will happen");
    expect(t("confirm.irreversibleText", { count: 1 })).toBe("The status of 1 order changes immediately.");
    expect(t("finalizeSuccessDescription", { count: 1 })).toBe("1 order was finalized successfully");
    expect(t("finalizeSuccessDescription", { count: 2 })).toBe("2 orders were finalized successfully");
    expect(t("finalizeErrorDescription", { count: 1 })).toBe("1 order failed");
    expect(t("finalizeTomorrowKept", { count: 3 })).toBe("3 orders postponed to tomorrow.");
  });

  it("ru: one / few / many", async () => {
    const t = await translator("ru");
    expect(t("finalizeSuccessDescription", { count: 1 })).toBe("1 заказ успешно завершён");
    expect(t("finalizeSuccessDescription", { count: 3 })).toBe("3 заказа успешно завершены");
    expect(t("finalizeSuccessDescription", { count: 5 })).toBe("5 заказов успешно завершены");
    expect(t("finalizeErrorDescription", { count: 21 })).toBe("Ошибка в 21 заказе");
    expect(t("finalizeErrorDescription", { count: 2 })).toBe("Ошибка в 2 заказах");
  });

  it("uz has no plural forms: one wording for every number", async () => {
    const t = await translator("uz");
    expect(t("finalizeTomorrowKept", { count: 1 })).toBe("1 ta buyurtma ertaga qoldirildi.");
    expect(t("finalizeTomorrowKept", { count: 2 })).toBe("2 ta buyurtma ertaga qoldirildi.");
    expect(t("confirm.irreversibleText", { count: 1 })).toBe("1 ta buyurtma holati darhol o'zgaradi.");
  });
});
