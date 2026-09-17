import { describe, expect, it } from "vitest";
import uz from "../../locales/uz/integrations.json";
import ru from "../../locales/ru/integrations.json";
import en from "../../locales/en/integrations.json";

/**
 * INTEGRATSIYALAR SAHIFASI — TARJIMA QAMROVI.
 *
 * ⚠️ NEGA BU TEST KERAK. Matnlar kalitlarga ko'chirilgandan keyin ham eng
 * oson buziladigan narsa — YANGI kalit. Odam `uz` ga qo'shadi, `ru`/`en` ni
 * unutadi. Natija JIM: i18next fallback tufayli rus tilida ham o'zbekcha
 * matn chiqadi, xato ham, ogohlantirish ham bo'lmaydi.
 *
 * Shu bois uch narsa qulflanadi: kalitlar to'plami AYNI, qiymat bo'sh emas,
 * va tarjima haqiqatan qilingan (ruschada kirill, inglizchada o'zbekcha
 * qoldiq yo'q).
 */

type Dict = Record<string, string>;
const UZ = uz as Dict;
const RU = ru as Dict;
const EN = en as Dict;

/**
 * Ruscha qiymatda kirill BO'LMASLIGI oqlangan kalitlar.
 *
 * Uchala tilda AYNI bo'lgan texnik tokenlar (`CRM`, `Slug`), sof
 * interpolatsiya (`rawValue` = `{{value}}`) va gap tuzilishi tufayli
 * bo'sh qolgan bo'lak: ruschada butun gap `wzNextPartner2a` ichida,
 * shuning uchun ikkinchi bo'lak faqat nuqta.
 */
const RU_NO_CYRILLIC_OK = new Set([
  "categoryCrm",
  "fSlugLabel",
  "fCrmLabel",
  "rawValue",
  "wzNextPartner2b",
]);

/**
 * Bo'sh qiymat ATAYLAB qo'yilgan kalitlar. O'zbekchadagi sanoq qo'shimchasi
 * ("3 ta") ingliz tilida yo'q — "3" ning o'zi to'g'ri.
 */
const EMPTY_OK = new Set(["stlCountSuffix"]);

describe("⭐ integrations i18n — uch til teng", () => {
  it("tarjima fayllari bo'sh emas (test bo'shliqda ishlamasin)", () => {
    expect(Object.keys(UZ).length).toBeGreaterThan(400);
  });

  it("⭐ kalitlar to'plami AYNI — biror tilda tushib qolmagan", () => {
    const uzKeys = Object.keys(UZ).sort();
    expect(Object.keys(RU).sort(), "ru kalitlari uz bilan mos emas").toEqual(uzKeys);
    expect(Object.keys(EN).sort(), "en kalitlari uz bilan mos emas").toEqual(uzKeys);
  });

  it("⭐ hech bir qiymat BO'SH emas", () => {
    for (const [lang, dict] of [
      ["uz", UZ],
      ["ru", RU],
      ["en", EN],
    ] as const) {
      for (const [key, value] of Object.entries(dict)) {
        if (EMPTY_OK.has(key)) continue;
        expect(value.trim(), `${lang}.${key} bo'sh`).not.toBe("");
      }
    }
  });

  it("⭐ ruscha matn HAQIQATAN tarjima qilingan (kirill bor)", () => {
    const hasWord = /[A-Za-z]{3,}/;
    const hasCyrillic = /[А-Яа-яЁё]/;
    for (const [key, value] of Object.entries(RU)) {
      if (RU_NO_CYRILLIC_OK.has(key)) continue;
      // So'zsiz qiymat (raqam, belgi) tarjimaga muhtoj emas.
      if (!hasWord.test(UZ[key])) continue;
      expect(hasCyrillic.test(value), `ru.${key} tarjima qilinmagan: ${value}`).toBe(true);
    }
  });

  it("⭐ inglizcha matnda O'ZBEKCHA qoldiq yo'q", () => {
    // Bu bo'g'inlar ingliz tilida uchramaydi — ya'ni ko'chirib qo'yilgan.
    const uzbekMarker = /(bo['’]l|yo['’]q|so['’]rov|o['’]zgar|kerak|uchun|qiling)/i;
    for (const [key, value] of Object.entries(EN)) {
      expect(uzbekMarker.test(value), `en.${key} hali o'zbekcha: ${value}`).toBe(false);
    }
  });

  it("⭐ interpolatsiya nomlari uch tilda AYNI", () => {
    /**
     * `{{count}}` ni ruschada `{{kol}}` deb yozib qo'yish JIM buzilish:
     * i18next topmaydi va o'rniga qiymat QO'YILMAYDI — foydalanuvchi
     * `{{count}}` ni ko'radi.
     */
    const vars = (s: string) => (s.match(/\{\{(\w+)\}\}/g) ?? []).sort().join(",");
    for (const key of Object.keys(UZ)) {
      const want = vars(UZ[key]);
      if (!want) continue;
      expect(vars(RU[key]), `ru.${key} interpolatsiyasi mos emas`).toBe(want);
      expect(vars(EN[key]), `en.${key} interpolatsiyasi mos emas`).toBe(want);
    }
  });
});
