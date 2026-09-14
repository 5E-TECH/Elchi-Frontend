import { describe, expect, it } from "vitest";
import { CONNECTION_TYPES, TYPE_CHANGE_FIELDS } from "./connections";
import { CATEGORY_LABEL, ROLE_META } from "../../entities/integrations";

/**
 * ATAMA VA YOZUV IZCHILLIGI.
 *
 * ⚠️ NEGA TEST BILAN QULFLANADI. Bu turdagi nomuvofiqlik hech qachon xato
 * bermaydi: sahifa ishlaydi, faqat o'qiyotgan odam ikkilanadi. Shu bois u
 * jimgina qaytadi — bir tahrirda bitta so'z boshqacha yozilsa yetarli.
 */

const sources = import.meta.glob("./**/*.{ts,tsx}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const entries = Object.entries(sources).filter(([file]) => !file.includes(".test."));

describe("apostrof — bitta kod nuqtasi", () => {
  it("sahifa fayllari topildi (test bo'shliqda ishlamasin)", () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  it("⭐ JINGALAK apostrof ISHLATILMAYDI", () => {
    /**
     * Ilova standarti — ASCII `'` (`src/locales/uz/` da 637 marta:
     * `O'zgarishlarni`, `Qo'shish`, `yo'q`, `Ma'lumot`). Bu sahifada esa
     * uch xil kod nuqtasi aralash edi: ASCII, U+2018 (102 marta) va
     * U+2019 (8 marta). Bitta jadvalda ikki xil glif chiqardi.
     *
     * ⚠️ Nega ASCII tanlandi: sahifa i18n'ga o'tkazilganda matnlar
     * `locales/uz/*.json` ga ko'chadi va u yerda ASCII ishlatiladi —
     * ya'ni hozir jingalakda qoldirsak, keyin IKKINCHI migratsiya kerak
     * bo'lardi.
     *
     * ⚠️ Diqqat: ASCII apostrof bir tirnoqli JS satrini buzadi. Shu bois
     * bunday satrlar ikki tirnoqqa o'tkazilgan (yoki `\\'` bilan
     * ekranlangan) — prettier buni o'zi boshqaradi.
     */
    for (const [file, src] of entries) {
      expect(src, `${file} da U+2018 bor`).not.toContain("‘");
      expect(src, `${file} da U+2019 bor`).not.toContain("’");
    }
  });
});

describe("⭐ ATAMALAR — bir tushuncha, bir nom", () => {
  /** Barcha foydalanuvchiga ko'rinadigan yorliqlar. */
  const labels = CONNECTION_TYPES.flatMap((t) => [
    t.label,
    t.desc,
    ...t.fields.map((f) => f.label),
    ...t.fields.map((f) => f.hint ?? ""),
  ]).filter(Boolean);

  it("yorliqlar to'plami bo'sh emas", () => {
    expect(labels.length).toBeGreaterThan(30);
  });

  it("⭐ XOM inglizcha STATUS kodi ko'rsatilmaydi", () => {
    /**
     * ⚠️ AVVALGI URINISHIM XATO EDI: "inglizcha so'z bormi?" deb belgi
     * sinfi bilan tekshirgandim — o'zbek ham LOTIN alifbosida, ya'ni
     * `[A-Za-z]+` hamma so'zni tutadi va test 617 ta "xato" topdi. Uni
     * tashladim.
     *
     * Endi ANIQ ro'yxat: bizning ichki status qiymatlari. Ular
     * `Order_status` enum'idan keladi va operator ekranida chiqmasligi
     * kerak — `useStatusLabel` ularni o'zbekchaga aylantiradi.
     *
     * ⚠️ `provider_status` BUNGA KIRMAYDI: u tashuvchining o'z qiymati va
     * XOM qolishi KERAK ("ular aynan nima dedi?").
     */
    const RAW_STATUSES = [
      '"waiting"',
      '"on the road"',
      '"cancelled (sent)"',
      '"returned_to_market"',
      '"partly_paid"',
    ];

    for (const [file, src] of entries) {
      // Faqat JSX matnida chiqishi muhim; xarita kalitlari qonuniy.
      if (!file.includes("panels/") && !file.includes("Page")) continue;
      for (const raw of RAW_STATUSES) {
        expect(
          src.includes(`>${raw.slice(1, -1)}<`),
          `${file} da xom status ko'rsatilgan: ${raw}`,
        ).toBe(false);
      }
    }
  });

  it("⭐ BITTA AMAL — bitta nom", () => {
    /**
     * Ilgari sinov amali uch xil nomlanardi: "Ulanishni sinash",
     * "Aloqani tekshirish", "Sinash". Operator ular boshqa-boshqa narsa
     * deb o'ylardi. Endi fe'l BITTA ("sinash"), farq esa OBYEKTDA
     * ("Aloqani sinash" — tashqi API'ga ping; "Sinash" — hamkorga sinov
     * hodisasi).
     */
    const all = entries.map(([, src]) => src).join("\n");
    expect(all).not.toContain("Aloqani tekshirish");
    expect(all).not.toContain("Ulanishni sinash");
  });

  it("⭐ BEKOR QILISH — ilova standarti", () => {
    // `locales/uz/common.json` → `"cancel": "Bekor qilish"`.
    for (const [file, src] of entries) {
      expect(src, `${file} da qisqartirilgan "Bekor"`).not.toContain('cancelText="Bekor"');
    }
  });

  it("⭐ TUGMA matni AMALNI aytadi, holatni emas", () => {
    /**
     * Ilgari o'zgarish bo'lmasa tugma matni "O'zgarish yo'q" ga aylanardi.
     * Tugma nima QILISHINI aytishi kerak; holat esa uning o'chirilganida
     * va yonidagi izohda ko'rinadi.
     */
    const all = entries.map(([, src]) => src).join("\n");
    expect(all).not.toMatch(/\?\s*"Turini o'zgartirish"\s*:\s*"O'zgarish yo'q"/);
  });

  it("⭐ 'Boshqaruv' endi BITTA narsani nomlamaydi", () => {
    /**
     * U UCH joyda ishlatilardi: navigatsiya yuzasi, sahifa sarlavhasi va
     * panel ichidagi tab — ya'ni "Boshqaruv → Boshqaruv" degan yo'l
     * chiqardi. Navigatsiya va sarlavha "Konsol" (matnlarda allaqachon
     * ishlatilgan atama), tab esa "Ish rejimi".
     */
    const labels = entries
      .map(([, src]) => src)
      .join("\n")
      .match(/label: "Boshqaruv"/g);
    expect(labels ?? []).toEqual([]);
  });

  it("⭐ har bir maydonda YORLIQ bor", () => {
    // Yorliqsiz maydon "nima yozish kerak?" degan savol qoldiradi.
    for (const type of CONNECTION_TYPES) {
      for (const f of type.fields) {
        expect(f.label.trim().length, `${type.key}.${f.key}`).toBeGreaterThan(2);
      }
    }
  });
});

describe("⭐ TAKSONOMIYA — bir qiymat, bir yozuv", () => {
  /**
   * ⚠️ TAKSONOMIYA i18n KALITIGA AYLANDI (2026-09-14), shu bois tekshiruv
   * lokal FAYLI orqali qilinadi.
   *
   * Ilgari `cargo` kartada inglizcha "Cargo", tanlash ro'yxatida esa
   * "Kargo" deb yozilardi — bitta tur ikki xil ko'rinardi.
   *
   * `Marketplace` va `CRM` ATAYLAB shu shaklda qoladi: ular o'zbek tilida
   * ham, rus tilida ham xalqaro atama sifatida ishlatiladi.
   */
  const uz = Object.entries(
    import.meta.glob<Record<string, string>>("../../locales/uz/integrations.json", {
      eager: true,
      import: "default",
    }),
  )[0][1];

  const categoryOptions = TYPE_CHANGE_FIELDS.find((f) => f.key === "category")?.options ?? [];

  it("kategoriya tanlash ro'yxati topildi", () => {
    expect(categoryOptions.length).toBeGreaterThan(4);
  });

  it("⭐ qisqa yorliq TANLASH yorlig'i ichida bo'ladi", () => {
    /**
     * Kartadagi qisqa yorliq va formadagi uzun yorliq ("Marketplace / sayt")
     * FARQ QILISHI mumkin — biri nishon, ikkinchisi tanlov. Lekin ular AYNI
     * so'zdan boshlanishi kerak, aks holda operator ikkisini bog'lay
     * olmaydi.
     */
    for (const opt of categoryOptions) {
      const key = CATEGORY_LABEL[opt.value as keyof typeof CATEGORY_LABEL];
      const short = uz[key];
      expect(short, `${opt.value} uchun tarjima yo'q`).toBeTruthy();
      expect(
        opt.label.includes(short!),
        `"${opt.label}" ichida "${short}" yo'q — ikki xil yozilgan`,
      ).toBe(true);
    }
  });

  it("⭐ `cargo` O'ZBEKCHA yozilgan", () => {
    // Aniq regressiya qulfi: ilgari "Cargo" edi.
    expect(uz[CATEGORY_LABEL.cargo]).toBe("Kargo");
  });

  it("rol yorliqlari bo'sh emas va inglizcha kod EMAS", () => {
    for (const [role, meta] of Object.entries(ROLE_META)) {
      const label = uz[meta.labelKey];
      expect(label, `${role} tarjimasi yo'q`).toBeTruthy();
      expect(label!.length).toBeGreaterThan(3);
      // Enum qiymatining o'zi yorliq bo'lib qolmasin ("carrier", "source").
      expect(label!.toLowerCase()).not.toBe(role);
    }
  });
});
