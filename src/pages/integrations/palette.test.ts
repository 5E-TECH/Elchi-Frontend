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

describe("⭐ QORONG'I YUZA — bitta rang, uch joyda bir xil", () => {
  /**
   * NIMA BUZILGAN EDI. Bitta ekranda UCH XIL qorong'i yuza bor edi:
   *
   *   sahifa foni    #2a2540  (`index.css` — `--color-dark-bg-py`)
   *   Tailwind karta #2A263D  ← fondan kontrast 1.00, MUTLAQO ajralmaydi
   *   antd karta     #141414  ← neytral qora, binafsha sahifada begona
   *
   * Foydalanuvchi shikoyati: "bg qora rangga o'tmayapti".
   *
   * ⚠️ IKKI NUSXA ATAYLAB: Tailwind sinf satrida hex LITERAL yozilishi
   * shart (skaner shablon ifodasini o'qiy olmaydi va qoidani umuman
   * yaratmaydi — karta shaffof bo'lib qolardi), antd esa JS tokenini
   * oladi. Bu test ikkisini bir xil ushlab turadi.
   */

  /**
   * IZOHLARSIZ manba. Izohlarda aynan shu naqshlar TUSHUNTIRILADI
   * ("`dark:text-gray-500` ishlatmang") — ularni taqiqlash foydali
   * hujjatni yo'q qilardi. Tekshiruv faqat KODGA tegishli.
   */
  const uiCode = () => {
    const raw = Object.entries(
      import.meta.glob("./ui.ts", {
        eager: true,
        query: "?raw",
        import: "default",
      }) as Record<string, string>,
    )[0]?.[1];
    return (raw ?? "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  };

  const SURFACE = "#3A3358";
  const PAGE = "#2a2540";

  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("Tailwind sinflari LITERAL hex ishlatadi (shablon ifodasi EMAS)", () => {
    /**
     * ⚠️ ENG MUHIM TEKSHIRUV. `` `dark:bg-[${TOKEN}]` `` yozilsa Tailwind
     * skaneri yaroqsiz nom ko'radi va qoidani YARATMAYDI — karta
     * qorong'ida shaffof bo'lib qoladi. Xato build'da ham, typecheck'da
     * ham chiqmaydi: faqat ekranda ko'rinadi.
     */
    const code = uiCode();

    expect(code.length).toBeGreaterThan(100);
    // Sinf satrida interpolyatsiya bo'lmasligi kerak.
    expect(code).not.toMatch(/dark:bg-\[\$\{/);
    // Literal yozuv esa bo'lishi kerak.
    expect(code).toContain("dark:bg-[#3A3358]");
  });

  it("eski, fonga singib ketgan rang QAYTMAYDI", () => {
    // `.tsx` fayllarida sinf satrlari; `ui.ts` alohida (izohsiz).
    for (const [file, src] of entries) {
      expect(src, `${file} da eski yuza rangi`).not.toContain("#2A263D");
    }
    expect(uiCode()).not.toContain("#2A263D");
  });

  it("⭐ yuza fondan AJRALADI", () => {
    // 1.00 = ajralmaydi. antd sukuti 1.26 beradi; biz ham shu darajada.
    expect(contrast(SURFACE, PAGE)).toBeGreaterThan(1.2);
  });

  it("⭐ yuza ustidagi matnlar AA dan o'tadi", () => {
    // `MUTED` qorong'ida `gray-400`; `TITLE`/`BODY` oq va `gray-200`.
    expect(contrast("#ffffff", SURFACE)).toBeGreaterThan(4.5);
    expect(contrast("#e5e7eb", SURFACE)).toBeGreaterThan(4.5);
    expect(contrast("#9ca3af", SURFACE)).toBeGreaterThan(4.5);
  });

  it("⭐ `gray-500` bu yuzada ISHLATILMAYDI", () => {
    /**
     * `gray-500` yangi yuzada 2.42:1 — AA katta matn chegarasidan (3.0)
     * ham past. `FAINT` ilgari qorong'ida aynan shuni ishlatardi.
     */
    expect(contrast("#6b7280", SURFACE)).toBeLessThan(3);

    expect(uiCode()).not.toContain("dark:text-gray-500");
  });
});

describe("⭐ GRADIENT sarlavhalar — ustida OQ matn", () => {
  /**
   * Karta sarlavhasi sahifadagi eng ko'zga tashlanadigan element: ulanish
   * NOMI va holati aynan shu yerda. Ilgari `-500` tuslari ishlatilardi va
   * oq matn kontrasti 2.15–2.80 edi — OLTITASI HAM AA katta matn
   * chegarasidan (3.0) past, ya'ni sarlavha o'qilmasdi.
   *
   * ⚠️ Rang HOLATNI bildiradi, shu bois `dark:` varianti YO'Q: yashil
   * "ishlayapti" degani qorong'ida ham yashil bo'lishi kerak. Demak
   * kontrast bitta qiymatda ikkala mavzu uchun ham yetarli bo'lishi shart.
   */
  const TAILWIND: Record<string, string> = {
    "green-500": "#22c55e",
    "emerald-500": "#10b981",
    "amber-500": "#f59e0b",
    "orange-500": "#f97316",
    "gray-400": "#9ca3af",
    "green-600": "#16a34a",
    "emerald-700": "#047857",
    "amber-600": "#d97706",
    "orange-700": "#c2410c",
    "gray-500": "#6b7280",
    "gray-600": "#4b5563",
  };

  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const onWhite = (hex: string) => (1.05) / (lum(hex) + 0.05);

  const uiRaw = () =>
    Object.entries(
      import.meta.glob("./ui.ts", {
        eager: true,
        query: "?raw",
        import: "default",
      }) as Record<string, string>,
    )[0]?.[1] ?? "";

  it("⭐ ishlatilgan har bir gradient to'xtashi AA katta matndan o'tadi", () => {
    const code = uiRaw()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    const block = /cardHeader[\s\S]*?\}\[health\]/.exec(code)?.[0] ?? "";
    expect(block.length).toBeGreaterThan(50);

    const stops = [...block.matchAll(/(?:from|to)-([a-z]+-\d{3})/g)].map(
      (m) => m[1],
    );
    // Uch holat × ikki to'xtash = olti.
    expect(stops).toHaveLength(6);

    for (const stop of stops) {
      const hex = TAILWIND[stop];
      expect(hex, `${stop} uchun hex ro'yxatda yo'q`).toBeTruthy();
      expect(onWhite(hex!), `${stop} da oq matn o'qilmaydi`).toBeGreaterThan(3);
    }
  });

  it("eski, o'qilmaydigan tuslar QAYTMAYDI", () => {
    const code = uiRaw()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const block = /cardHeader[\s\S]*?\}\[health\]/.exec(code)?.[0] ?? "";

    for (const bad of ["green-500", "emerald-500", "amber-500", "orange-500"]) {
      expect(block, `${bad} qaytdi`).not.toContain(bad);
    }
  });

  it("⭐ nishon qatlami gradientni YORITMAYDI", () => {
    /**
     * `bg-white/20` yarim shaffof oq qatlam gradientni yoritib, ustidagi
     * oq matnni yo'q qiladi — sarlavha to'qlashtirilgandan keyin ham shu
     * nishon o'qilmay qolardi.
     */
    const overview = Object.entries(
      import.meta.glob("./OverviewPage.tsx", {
        eager: true,
        query: "?raw",
        import: "default",
      }) as Record<string, string>,
    )[0]?.[1] ?? "";

    expect(overview.length).toBeGreaterThan(100);
    expect(overview).toContain("bg-black/25");
  });
});
