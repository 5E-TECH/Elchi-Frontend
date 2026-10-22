import { describe, expect, it } from "vitest";

/**
 * «Hisob» (profil, sozlamalar, bildirishnomalar qutisi) matnlari uchala tilda bir xil kalitlar bilan
 * (`integrations/i18nCoverage.test.ts` naqshi). `notifications.json` dagi `dispatch.*` va `sent.*` — boshqa
 * sahifalar (xabar yuborish, «Yuborilganlar») egaligida, ko'plik qo'shimchalari bilan
 * `pages/notifications/i18nCoverage.test.ts` da tekshiriladi.
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

const keysOf = (language: string, namespace: string) => {
  const bundle = bundles[`../../locales/${language}/${namespace}.json`];
  expect(bundle, `${language}/${namespace}.json`).toBeDefined();
  return flatten(bundle)
    .filter(
      (key) =>
        !(
          namespace === "notifications" &&
          (key.startsWith("dispatch.") || key.startsWith("sent."))
        ),
    )
    .sort();
};

describe("Hisob sahifalari — uz/ru/en kalitlari teng", () => {
  it.each(["settings", "profile", "notifications"])("%s.json", (namespace) => {
    const uz = keysOf("uz", namespace);
    expect(uz.length).toBeGreaterThan(10);
    expect(keysOf("ru", namespace)).toEqual(uz);
    expect(keysOf("en", namespace)).toEqual(uz);
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
