import { describe, expect, it } from "vitest";
import { CATEGORY_LABEL, ROLE_META, type IntegrationCategory, type IntegrationRole } from "./index";

const LOCALES = ["uz", "ru", "en"] as const;

/** Uchala lokal fayli — `?raw` emas, JSON sifatida. */
const bundles = import.meta.glob<Record<string, string>>("../../locales/*/integrations.json", {
  eager: true,
  import: "default",
});

const localeOf = (lang: string): Record<string, string> => {
  const entry = Object.entries(bundles).find(([path]) => path.includes(`/${lang}/`));
  if (!entry) throw new Error(`${lang} lokali topilmadi`);
  return entry[1];
};

/**
 * ROL / KATEGORIYA TAKSONOMIYASI — UI qatlami.
 *
 * ⚠️ 2026-09-14 DA QIYMATLAR i18n KALITIGA AYLANDI. Ilgari bu yerda
 * o'zbekcha MATN turardi va sahifa i18n'dan tashqarida edi: til
 * almashtirilganda yorliqlar o'zbekcha qolib ketardi.
 *
 * Shu bois test endi lokal FAYLLARIGA qarshi ishlaydi. Bu kuchliroq
 * invariant: u nafaqat kalit borligini, balki UCHALA tilda tarjima
 * borligini ham tekshiradi — ya'ni yarim tarjima qilingan holat
 * (ru/en'da kalit yo'q → ekranda xom "roleCarrier") o'tib ketmaydi.
 *
 * Ilgari modelda faqat `type` (`api`/`webhook`/`ftp`) bor edi — u TRANSPORT.
 * "NIMA QILADI" degan savol yozilmasdi, shuning uchun UI'da yetkazuvchi,
 * buyurtma manbasi va to'lov tizimi bir xil ko'rinardi.
 *
 * Bu test yorliqlar to'liq qolishini qulflaydi: yangi rol qo'shilib yorlig'i
 * yozilmasa, UI'da xom kalit ("payment") chiqib ketardi.
 */
describe("Integratsiya taksonomiyasi", () => {
  const ROLES: IntegrationRole[] = ["carrier", "source", "payment", "mirror"];
  const CATEGORIES: IntegrationCategory[] = [
    "marketplace",
    "crm",
    "cargo",
    "payment",
    "spreadsheet",
    "other",
  ];

  it("⭐ har bir rol UCHALA tilda yorliq va IZOHga ega", () => {
    /**
     * Izoh majburiy: "carrier" va "source" farqi foydalanuvchi uchun
     * o'z-o'zidan tushunarli EMAS — aynan shu chalkashgan edi.
     *
     * Uchala til tekshiriladi: `uz` fallback bo'lgani uchun ru/en'da
     * kalit yo'qolsa ekranda o'zbekcha chiqadi va buni hech kim sezmaydi —
     * aynan foydalanuvchi shikoyat qilgan holat.
     */
    for (const lang of LOCALES) {
      const dict = localeOf(lang);
      for (const role of ROLES) {
        expect(ROLE_META[role]).toBeDefined();
        const label = dict[ROLE_META[role].labelKey];
        const hint = dict[ROLE_META[role].hintKey];
        expect(label, `${lang}/${role} yorlig'i yo'q`).toBeTruthy();
        expect(hint, `${lang}/${role} izohi yo'q`).toBeTruthy();
        expect(label!.trim().length).toBeGreaterThan(0);
        expect(hint!.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("rol yorliqlari HAR TILDA noyob (ikki rol bir xil ko'rinmasin)", () => {
    for (const lang of LOCALES) {
      const dict = localeOf(lang);
      const labels = ROLES.map((r) => dict[ROLE_META[r].labelKey]);
      expect(new Set(labels).size, `${lang} da takrorlanish`).toBe(labels.length);
    }
  });

  it("har bir kategoriya UCHALA tilda yorliqqa ega", () => {
    for (const lang of LOCALES) {
      const dict = localeOf(lang);
      for (const c of CATEGORIES) {
        expect(CATEGORY_LABEL[c]).toBeDefined();
        expect(dict[CATEGORY_LABEL[c]], `${lang}/${c}`).toBeTruthy();
      }
    }
  });

  it("ROLE_META da ORTIQCHA kalit yo'q (backend bilan mos)", () => {
    // Backend `normalizeRole` aynan shu to'rttasini qabul qiladi; UI'da
    // qo'shimcha rol bo'lsa, u saqlanmay jimgina `carrier`ga tushardi.
    expect(Object.keys(ROLE_META).sort()).toEqual([...ROLES].sort());
  });

  it("CATEGORY_LABEL da ORTIQCHA kalit yo'q", () => {
    expect(Object.keys(CATEGORY_LABEL).sort()).toEqual([...CATEGORIES].sort());
  });

  it("to'lov tizimi uchun rol MAVJUD (yangi talab)", () => {
    // Foydalanuvchi talabi: marketplace VA to'lov tizimlari uchun joy.
    expect(localeOf("uz")[ROLE_META.payment.labelKey]).toContain("To'lov");
    expect(localeOf("uz")[CATEGORY_LABEL.marketplace]).toBe("Marketplace");
  });

  it("⭐ UCHALA lokal AYNI kalitlarga ega", () => {
    /**
     * Yarim tarjima eng yomon holat: `uz` fallback tufayli yetishmagan
     * kalit ekranda o'zbekcha chiqadi va xato BILINMAYDI.
     */
    const [uz, ru, en] = LOCALES.map((l) => new Set(Object.keys(localeOf(l))));
    expect([...ru].sort()).toEqual([...uz].sort());
    expect([...en].sort()).toEqual([...uz].sort());
  });
});
