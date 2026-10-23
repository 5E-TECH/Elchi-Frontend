import { describe, expect, it } from "vitest";

/**
 * «Hisob» (profil, sozlamalar, bildirishnomalar qutisi) matnlari uchala tilda bir xil kalitlar bilan
 * (`integrations/i18nCoverage.test.ts` naqshi). `notifications.json` dagi `dispatch.*` va `sent.*` — boshqa
 * sahifalar (xabar yuborish, «Yuborilganlar») egaligida, ko'plik qo'shimchalari bilan
 * `pages/notifications/i18nCoverage.test.ts` da tekshiriladi.
 *
 * Ko'plik qo'shimchalari (`_one/_few/_many/_other`) bitta kalit sanaladi (o'zbekchada ko'plik yo'q — oddiy kalit), lekin
 * ko'plikli kalitda tilning BARCHA shakllari bo'lishi shart: ru — one/few/many/other, en — one/other.
 */
type Tree = { [key: string]: string | Tree };

const bundles = import.meta.glob<Tree>("../../locales/*/{settings,profile,notifications}.json", {
  eager: true,
  import: "default",
});

const flatten = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );

const PLURAL = /_(zero|one|two|few|many|other)$/;
const PLURAL_FORMS: Record<string, string[]> = { ru: ["few", "many", "one", "other"], en: ["one", "other"] };

const rawKeysOf = (language: string, namespace: string) => {
  const bundle = bundles[`../../locales/${language}/${namespace}.json`];
  expect(bundle, `${language}/${namespace}.json`).toBeDefined();
  return flatten(bundle).filter(
    (key) =>
      !(
        namespace === "notifications" &&
        (key.startsWith("dispatch.") || key.startsWith("sent."))
      ),
  );
};

const keysOf = (language: string, namespace: string) =>
  [...new Set(rawKeysOf(language, namespace).map((key) => key.replace(PLURAL, "")))].sort();

describe("Hisob sahifalari — uz/ru/en kalitlari teng", () => {
  it.each(["settings", "profile", "notifications"])("%s.json", (namespace) => {
    const uz = keysOf("uz", namespace);
    expect(uz.length).toBeGreaterThan(10);
    expect(keysOf("ru", namespace)).toEqual(uz);
    expect(keysOf("en", namespace)).toEqual(uz);
  });

  it.each(["settings", "profile", "notifications"])("%s.json — ko'plik shakllari to'liq", (namespace) => {
    for (const [language, forms] of Object.entries(PLURAL_FORMS)) {
      const keys = rawKeysOf(language, namespace);
      const plural = new Map<string, string[]>();
      for (const key of keys) {
        const match = PLURAL.exec(key);
        if (match) plural.set(key.replace(PLURAL, ""), [...(plural.get(key.replace(PLURAL, "")) ?? []), match[1]]);
      }
      for (const [base, found] of plural) {
        expect(found.sort(), `${language}/${namespace}: ${base}`).toEqual(forms);
        expect(keys, `${language}/${namespace}: ${base} — oddiy kalit bilan aralash`).not.toContain(base);
      }
    }
  });

  it("o'zbekcha matnlarda bo'sh qiymat yo'q", () => {
    for (const namespace of ["settings", "profile"]) {
      const bundle = bundles[`../../locales/uz/${namespace}.json`];
      const empty = flatten(bundle).filter((key) => {
        const value = key
          .split(".")
          .reduce<string | Tree>((node, part) => (node as Tree)[part], bundle);
        return typeof value !== "string" || value.trim() === "";
      });
      expect(empty, namespace).toEqual([]);
    }
  });
});
