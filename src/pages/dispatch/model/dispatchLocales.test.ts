import { createInstance } from "i18next";
import uz from "../../../locales/uz/dispatch.json";
import ru from "../../../locales/ru/dispatch.json";
import en from "../../../locales/en/dispatch.json";

/** «Kuryerga biriktirish» matnlari: uchala tilda bir xil kalitlar, en ko'plik shakllari («1 order», «2 orders»). */
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
    ns: ["dispatch"],
    defaultNS: "dispatch",
    resources: { uz: { dispatch: uz }, ru: { dispatch: ru }, en: { dispatch: en } },
    interpolation: { escapeValue: false },
  });
  return i18n.t.bind(i18n);
};

describe("dispatch locale", () => {
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
    expect(t("page.subtitle", { count: 1 })).toBe("1 order added");
    expect(t("page.subtitle", { count: 3 })).toBe("3 orders added");
    expect(t("selection.title", { count: 1 })).toBe("1 order selected");
    expect(t("lookup.checking", { count: 1 })).toBe("Checking 1 order...");
    expect(t("lookup.checking", { count: 2 })).toBe("Checking 2 orders...");
    expect(t("assign.success", { count: 1, courier: "Ali" })).toBe("1 order assigned to Ali");
    expect(t("courierDialog.description", { count: 2 })).toBe("2 orders will be assigned to this courier");
    expect(t("camera.context", { branch: "Urgut branch", value: "6" })).toBe("Urgut branch · 6 in the basket");
  });

  it("uz and ru keep their count-neutral wording for every number", async () => {
    const tUz = await translator("uz");
    const tRu = await translator("ru");
    expect(tUz("page.subtitle", { count: 1 })).toBe("1 ta buyurtma qo'shilgan");
    expect(tRu("page.subtitle", { count: 1 })).toBe("Добавлено заказов: 1");
    expect(tRu("page.subtitle", { count: 5 })).toBe("Добавлено заказов: 5");
  });
});
