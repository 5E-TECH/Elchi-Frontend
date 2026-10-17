import uz from "../../../locales/uz/mailsShell.json";
import ru from "../../../locales/ru/mailsShell.json";
import en from "../../../locales/en/mailsShell.json";

/** «Pochta» qobig'i matnlari uchala tilda (ru/en ko'plik shakllari bilan) bir xil kalitlarda. */
const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

/** `orders_one`, `orders_few` … → `orders` (i18next ko'plik qo'shimchalari). */
const baseKeys = (locale: unknown) =>
  new Set(flatten(locale).map((key) => key.replace(/_(zero|one|two|few|many|other)$/, "")));

describe("mailsShell locale", () => {
  it.each([
    ["ru", ru],
    ["en", en],
  ])("%s has the same keys as uz", (_, locale) => {
    expect([...baseKeys(locale)].sort()).toEqual([...baseKeys(uz)].sort());
  });

  it("ru/en plural keys always include the `_other` form", () => {
    for (const locale of [ru, en]) {
      const keys = flatten(locale);
      const plural = keys.filter((key) => /_(one|few|many)$/.test(key));
      for (const key of plural) {
        expect(keys).toContain(key.replace(/_(one|few|many)$/, "_other"));
      }
    }
  });
});
