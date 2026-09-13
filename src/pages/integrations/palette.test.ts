import { describe, expect, it } from "vitest";

/**
 * PALITRA QO'RIQCHISI.
 *
 * Foydalanuvchi shikoyati aniq edi: "Beepostdagi ranglari yaxshiroq, chunki
 * unda yozuvlar aniq ko'ringan". Sabab: bu sahifa Elchi'ning CSS
 * o'zgaruvchilarini (`var(--color-text-muted)`) ishlatardi va ikkilamchi
 * matn juda och chiqardi.
 *
 * Palitra PCS shkalasiga o'tkazildi. Bu test o'sha qarorni QULFLAB qo'yadi:
 * aks holda keyingi tahrirda och sinflar jimgina qaytadi va buni hech kim
 * sezmaydi — sahifa ishlashda davom etadi, faqat o'qish qiyinlashadi.
 *
 * ⚠️ Test fayl tizimini `node:fs` bilan O'QIMAYDI. Test fayllari
 * `tsconfig.vitest.json` ostida kompilyatsiya qilinadi va unda `node`
 * turlari yo'q — avval shu tuzoqqa tushilgan (`ops.reachability.test.ts`
 * izohiga qarang). Shu bois Vite'ning `import.meta.glob` + `?raw` ishlatiladi.
 */

const sources = import.meta.glob("./**/*.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const entries = Object.entries(sources);

describe("integratsiyalar palitrasi", () => {
  it("sahifa fayllari topildi (test bo'shliqda ishlamasin)", () => {
    // Glob buzilsa test JIMGINA o'tib ketardi — hech nima tekshirilmasdi.
    expect(entries.length).toBeGreaterThan(5);
  });

  it("⭐ CSS o'zgaruvchili rang sinflari QAYTMAYDI", () => {
    /**
     * `var(--color-text-muted)` va `var(--color-border-soft)` — aynan
     * kontrast shikoyatining manbasi. Ular Elchi'ning boshqa sahifalarida
     * qoladi, lekin BU sahifada PCS shkalasi ishlatiladi.
     */
    const bad = entries.filter(([, src]) =>
      /var\(--color-(text-muted|border-soft|main)/.test(src),
    );
    expect(bad.map(([f]) => f)).toEqual([]);
  });

  it("⭐ eski tema sinflari qaytmaydi (`text-maindark`, `bg-primary`)", () => {
    const bad = entries.filter(([, src]) =>
      /\btext-maindark\b|\bbg-primarydark\b|\bbg-primary\b(?!dark)/.test(src),
    );
    expect(bad.map(([f]) => f)).toEqual([]);
  });

  it("⭐ bitta sinf satrida IKKI `dark:text-*` bo'lmaydi", () => {
    /**
     * Bu eng ayyor xato: ikkinchisi birinchisini o'ldiradi va natija
     * tasodifiy bo'ladi. Palitra ko'chirilganda avtomatik almashtirish
     * aynan shunday to'qnashuvlar yasagan edi.
     */
    const offenders: string[] = [];
    for (const [file, src] of entries) {
      // Har bir qo'shtirnoq/teskari tirnoq ichidagi sinf satrini ko'ramiz.
      for (const m of src.matchAll(/["'`]([^"'`\n]{10,400})["'`]/g)) {
        const cls = m[1];
        if (!cls.includes("dark:text-")) continue;
        const count = (cls.match(/dark:text-/g) ?? []).length;
        if (count > 1) offenders.push(`${file}: ${cls.slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("⭐ yorug' rejimda MATN `gray-400` dan ochroq bo'lmaydi", () => {
    /**
     * `gray-300` yoki ochrog'i oq fonda o'qilmaydi (< 2:1). `gray-400`
     * chegarada va faqat 11px chip tavsifida ruxsat etilgan (`FAINT`).
     *
     * ⚠️ ISTISNO — BEZAK IKONKASI. Bo'sh holatdagi katta glif (`h-16 w-16`)
     * PCS'da `gray-300` bilan chiziladi va u MATN EMAS: o'qilmaydi, faqat
     * joyni belgilaydi. Istisno TOR: sinf satrida aniq ikonka o'lchami
     * bo'lishi shart. Shunchaki `gray-300` ga ruxsat bersak, qoida ma'nosini
     * yo'qotardi — aynan shu qoida foydalanuvchi shikoyatidan tug'ilgan.
     */
    const ICON_SIZE = /\b[hw]-(8|10|12|16)\b/;
    const offenders: string[] = [];

    for (const [file, src] of entries) {
      for (const m of src.matchAll(/["'`]([^"'`\n]{0,300})["'`]/g)) {
        const cls = m[1];
        if (!/(?<!dark:)\btext-gray-(100|200|300)\b/.test(cls)) continue;
        if (ICON_SIZE.test(cls)) continue;
        offenders.push(`${file}: ${cls.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("yorug' chegara sinfi qorong'i juftiga ega", () => {
    /**
     * `border-gray-200` qorong'i rejimda ko'rinmaydi. Juftlik fayl
     * darajasida tekshiriladi: sinf satrlari shablonlar orqali yig'ilishi
     * mumkin, shuning uchun aniq juftlikni talab qilish noto'g'ri natija
     * berardi.
     */
    for (const [file, src] of entries) {
      if (src.includes("border-gray-200")) {
        expect(src, `${file} — qorong'i chegara yo'q`).toContain(
          "dark:border-gray-700",
        );
      }
    }
  });
});
