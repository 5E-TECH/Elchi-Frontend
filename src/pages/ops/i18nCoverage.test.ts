import { describe, expect, it } from "vitest";
import uzOps from "../../locales/uz/ops.json";
import ruOps from "../../locales/ru/ops.json";
import enOps from "../../locales/en/ops.json";
import uzLogs from "../../locales/uz/activityLogs.json";
import ruLogs from "../../locales/ru/activityLogs.json";
import enLogs from "../../locales/en/activityLogs.json";

/**
 * «Tizim» bo'limi (Ops vositalari, Faoliyat jurnali) — TARJIMA QAMROVI (`integrations/i18nCoverage.test.ts`
 * naqshi): uchala tilda kalitlar to'plami AYNI, qiymat bo'sh emas, ruschada kirill bor.
 */

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});

/** Uchala tilda bir xil bo'lishi to'g'ri bo'lgan texnik qiymatlar (ID, raqam, prefiks, interpolatsiya). */
const RU_NO_CYRILLIC_OK = /^(.*\.)?(id|idValue|batchPrefix|selectedOf|orderLink|count|email)$|fields\.id$|columns\.time$/;

describe.each([
  ["ops", uzOps, ruOps, enOps],
  ["activityLogs", uzLogs, ruLogs, enLogs],
])("%s i18n — uch til teng", (_name, uz, ru, en) => {
  const UZ = flatten(uz as Tree);
  const RU = flatten(ru as Tree);
  const EN = flatten(en as Tree);

  it("kalitlar to'plami AYNI", () => {
    const keys = Object.keys(UZ).sort();
    expect(keys.length).toBeGreaterThan(20);
    expect(Object.keys(RU).sort(), "ru").toEqual(keys);
    expect(Object.keys(EN).sort(), "en").toEqual(keys);
  });

  it("hech bir qiymat bo'sh emas", () => {
    for (const [lang, dict] of [
      ["uz", UZ],
      ["ru", RU],
      ["en", EN],
    ] as const) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${lang}:${key}`).not.toBe("");
      }
    }
  });

  it("ruscha qiymatlar tarjima qilingan (kirill bor)", () => {
    const untranslated = Object.entries(RU)
      .filter(([key]) => !RU_NO_CYRILLIC_OK.test(key))
      .filter(([, value]) => !/[а-яё]/i.test(value) && /[a-z]{3,}/i.test(value.replace(/\{\{[^}]+\}\}/g, "")))
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });
});
