import { describe, expect, it } from "vitest";

/**
 * SUDGlPuj — `payments` nomlar fazosida KODDA ishlatilgan har kalit uz/ru/en fayllarining uchalasida bor.
 * Ilgari Balans → Tahlil `t("week")` / `t("month")` / `t("year")` so'rardi, `payments.json` da esa faqat `today`
 * bor edi — i18next kalitning o'zini qaytarib, ekranda «week / month / year» chiqardi. Fayllar o'zaro teng bo'lishi
 * (kalitlar soni) bunday xatoni ushlamaydi: kalit uchala fayldan ham yo'q bo'lishi mumkin.
 *
 * Tekshiriladi: standart nomlar fazosi `payments` bo'lgan (`useTranslation("payments")` yoki `["payments", …]`)
 * fayldagi `t("…")` chaqiruvlari — matnli kalit, `ns:` siz va `ns:kalit` prefiksisiz. Faylda boshqa standart
 * nomlar fazosi ham bo'lsa (bir faylda bir nechta komponent) — `t` qaysi biriga tegishliligi aniq emas, o'tkaziladi.
 */
type Tree = { [key: string]: string | Tree };

const locales = import.meta.glob<Tree>("../locales/*/payments.json", { eager: true, import: "default" });
const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../test/**"], {
  eager: true,
  query: "?raw",
  import: "default",
});

const flatten = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );

const PLURAL_FORMS = ["zero", "one", "two", "few", "many", "other"];
const keysOf = (language: string) => {
  const bundle = locales[`../locales/${language}/payments.json`];
  expect(bundle, `${language}/payments.json`).toBeDefined();
  return new Set(flatten(bundle));
};
const has = (keys: Set<string>, key: string) => keys.has(key) || PLURAL_FORMS.some((form) => keys.has(`${key}_${form}`));

/** `useTranslation(...)` ning standart nomlar fazosi (birinchi argument yoki massivning birinchisi). */
const defaultNamespaces = (source: string) =>
  [...source.matchAll(/useTranslation\(\s*(?:"([^"]+)"|\[\s*"([^"]+)")/g)].map((match) => match[1] ?? match[2]);

/** `t("kalit", …)` — chaqiruv argumentlari (qavslar muvozanati bilan), `ns:` bo'lsa boshqa nomlar fazosi. */
const usedKeys = (source: string) => {
  const keys: string[] = [];
  for (const match of source.matchAll(/(?<![\w.$])t\(\s*"([^"]+)"/g)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    const start = index;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      index += 1;
    }
    const args = source.slice(start, index);
    const key = match[1];
    if (/\bns\s*:/.test(args) || key.includes(":") || key.includes("${")) continue;
    keys.push(key);
  }
  return keys;
};

describe("payments — kodda ishlatilgan kalitlar uz/ru/en da bor (SUDGlPuj)", () => {
  const checked = Object.entries(sources).filter(([, source]) => {
    const namespaces = defaultNamespaces(source);
    return namespaces.length > 0 && namespaces.every((ns) => ns === "payments");
  });

  it("payments fayllari topildi (glob ishlayapti)", () => {
    expect(checked.length).toBeGreaterThan(15);
  });

  it.each(["uz", "ru", "en"])("%s/payments.json — hech bir ishlatilgan kalit yetishmaydi", (language) => {
    const keys = keysOf(language);
    const missing = checked.flatMap(([file, source]) =>
      usedKeys(source)
        .filter((key) => !has(keys, key))
        .map((key) => `${file.replace("../", "src/")}: ${key}`),
    );
    expect([...new Set(missing)]).toEqual([]);
  });

  it("Balans → Tahlil: davr tugmalari kalitlari uchala tilda (Bugun · Bu hafta · Bu oy · Barchasi)", () => {
    const expected: Record<string, string[]> = {
      uz: ["Bugun", "Bu hafta", "Bu oy", "Barchasi"],
      ru: ["Сегодня", "Эта неделя", "Этот месяц", "Все"],
      en: ["Today", "This week", "This month", "All"],
    };
    for (const [language, labels] of Object.entries(expected)) {
      const analysis = (locales[`../locales/${language}/payments.json`].v2Balance as Tree).analysis as Tree;
      expect(["today", "week", "month", "all"].map((key) => analysis[key]), language).toEqual(labels);
    }
  });
});
