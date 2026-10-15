import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import {
  RELATIVE_DAY_LABEL,
  formatDateLocalized,
  formatDateTimeLocalized,
  formatTimeLocalized,
  toValidDate,
} from "./formatDateTime";

/**
 * SANA VA VAQT — dizayn v2 (DESIGN_SYSTEM §7, maket `Main` → «Format standarti»):
 * bugun "Bugun, 14:15", kecha "Kecha, 18:04", eskiroq "06.10.2026, 19:05" (hamma tilda KK.OO.YYYY).
 * Hamma `Date` mahalliy vaqtda yaratiladi — test istalgan vaqt mintaqasida bir xil natija beradi.
 */

/** Mahalliy vaqt: oy 1 dan (o'qishga qulay). */
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s);

const NOW = at(2026, 10, 8, 15, 30);

describe("formatDateLocalized / formatTimeLocalized", () => {
  it("KK.OO.YYYY va 24 soatlik SS:dd, nol bilan to'ldiriladi", () => {
    expect(formatDateLocalized(at(2026, 10, 6, 19, 5))).toBe("06.10.2026");
    expect(formatDateLocalized(at(2026, 1, 2))).toBe("02.01.2026");
    // Yil har doim 4 xona (YYYY), ISO "0099-01-01" → "01.01.0099", "01.01.99" emas.
    expect(formatDateLocalized("0099-01-01")).toBe("01.01.0099");
    expect(formatDateTimeLocalized("0099-01-01T09:05", { now: NOW })).toBe("01.01.0099, 09:05");
    expect(formatTimeLocalized(at(2026, 10, 6, 19, 5))).toBe("19:05");
    expect(formatTimeLocalized(at(2026, 10, 6, 9, 30))).toBe("09:30");
    expect(formatTimeLocalized(at(2026, 10, 6, 0, 0))).toBe("00:00");
    expect(formatTimeLocalized(at(2026, 10, 6, 23, 59, 59))).toBe("23:59");
  });

  it("format hamma tilda bir xil", () => {
    for (const language of ["uz", "ru", "en"]) {
      expect(formatDateLocalized(at(2026, 10, 8), { language })).toBe("08.10.2026");
      expect(formatTimeLocalized(at(2026, 10, 8, 14, 15), { language })).toBe("14:15");
    }
  });
});

describe("formatDateTimeLocalized — nisbiy kun", () => {
  it.each([
    ["uz", "Bugun, 14:15", "Kecha, 18:04"],
    ["ru", "Сегодня, 14:15", "Вчера, 18:04"],
    ["en", "Today, 14:15", "Yesterday, 18:04"],
  ])("%s: bugun va kecha", (language, today, yesterday) => {
    expect(formatDateTimeLocalized(at(2026, 10, 8, 14, 15), { language, now: NOW })).toBe(today);
    expect(formatDateTimeLocalized(at(2026, 10, 7, 18, 4), { language, now: NOW })).toBe(yesterday);
  });

  it.each(["uz", "ru", "en"])("%s: eskiroq — to'liq sana, vergul bilan", (language) => {
    expect(formatDateTimeLocalized(at(2026, 10, 6, 19, 5), { language, now: NOW })).toBe("06.10.2026, 19:05");
  });

  it("til kodi `ru-RU`, `EN` ham tushuniladi; noma'lum til — uz", () => {
    expect(formatDateTimeLocalized(at(2026, 10, 8, 9, 0), { language: "ru-RU", now: NOW })).toBe("Сегодня, 09:00");
    expect(formatDateTimeLocalized(at(2026, 10, 8, 9, 0), { language: "EN", now: NOW })).toBe("Today, 09:00");
    expect(formatDateTimeLocalized(at(2026, 10, 8, 9, 0), { language: "de", now: NOW })).toBe("Bugun, 09:00");
  });

  it("kun — kalendar bo'yicha: yarim tundan keyin kechagi 23:59 «Kecha», 24 soat ichidagi oldingi kun emas", () => {
    const justAfterMidnight = at(2026, 10, 8, 0, 1);
    expect(formatDateTimeLocalized(at(2026, 10, 7, 23, 59), { now: justAfterMidnight, language: "uz" })).toBe(
      "Kecha, 23:59",
    );
    expect(formatDateTimeLocalized(at(2026, 10, 8, 0, 0), { now: justAfterMidnight, language: "uz" })).toBe(
      "Bugun, 00:00",
    );
    const lateEvening = at(2026, 10, 8, 23, 59);
    // 26 soat oldin — lekin baribir kecha (07.10).
    expect(formatDateTimeLocalized(at(2026, 10, 7, 0, 0), { now: lateEvening, language: "uz" })).toBe("Kecha, 00:00");
    // 2 daqiqa oldin, o'sha kalendar kuni — bugun.
    expect(formatDateTimeLocalized(at(2026, 10, 8, 23, 57), { now: lateEvening, language: "uz" })).toBe("Bugun, 23:57");
    // Ikki kun oldin, 23:59 — 24 soatdan sal ko'p, lekin «Kecha» emas.
    expect(formatDateTimeLocalized(at(2026, 10, 6, 23, 59), { now: justAfterMidnight, language: "uz" })).toBe(
      "06.10.2026, 23:59",
    );
  });

  it("oy va yil chegarasi", () => {
    expect(formatDateTimeLocalized(at(2026, 9, 30, 20, 0), { now: at(2026, 10, 1, 8, 0), language: "uz" })).toBe(
      "Kecha, 20:00",
    );
    expect(formatDateTimeLocalized(at(2025, 12, 31, 23, 30), { now: at(2026, 1, 1, 0, 10), language: "ru" })).toBe(
      "Вчера, 23:30",
    );
    expect(formatDateTimeLocalized(at(2025, 12, 30, 23, 30), { now: at(2026, 1, 1, 0, 10), language: "en" })).toBe(
      "30.12.2025, 23:30",
    );
    // Kabisa yili: 29.02 → 01.03.
    expect(formatDateTimeLocalized(at(2028, 2, 29, 12, 0), { now: at(2028, 3, 1, 9, 0), language: "uz" })).toBe(
      "Kecha, 12:00",
    );
    // Bir yil oldingi xuddi shu kun — bugun emas.
    expect(formatDateTimeLocalized(at(2025, 10, 8, 14, 15), { now: NOW, language: "uz" })).toBe("08.10.2025, 14:15");
  });

  it("kelajakdagi sana — to'liq ko'rinishda (ertangi kun «Bugun» emas)", () => {
    expect(formatDateTimeLocalized(at(2026, 10, 9, 10, 0), { now: NOW, language: "uz" })).toBe("09.10.2026, 10:00");
    expect(formatDateTimeLocalized(at(2026, 10, 8, 22, 0), { now: NOW, language: "uz" })).toBe("Bugun, 22:00");
  });

  it("`relative: false` — har doim to'liq sana", () => {
    expect(formatDateTimeLocalized(at(2026, 10, 8, 14, 15), { now: NOW, relative: false })).toBe("08.10.2026, 14:15");
  });

  it("`now` — son (epoch) ham bo'ladi; berilmasa joriy vaqt", () => {
    expect(formatDateTimeLocalized(at(2026, 10, 7, 18, 4), { now: NOW.getTime(), language: "uz" })).toBe(
      "Kecha, 18:04",
    );
    const fresh = new Date();
    fresh.setSeconds(0, 0);
    expect(formatDateTimeLocalized(fresh, { language: "uz" })).toMatch(/^(Bugun|Kecha), \d{2}:\d{2}$/);
  });
});

describe("formatDateTimeLocalized — til i18n'dan (resolveMoneyLanguage bilan bir xil)", () => {
  const initial = i18n.language;
  afterEach(async () => {
    await i18n.changeLanguage(initial);
  });

  it("til berilmasa — i18n joriy tili", async () => {
    await i18n.changeLanguage("uz");
    expect(formatDateTimeLocalized(at(2026, 10, 8, 14, 15), { now: NOW })).toBe("Bugun, 14:15");
    await i18n.changeLanguage("en");
    expect(formatDateTimeLocalized(at(2026, 10, 8, 14, 15), { now: NOW })).toBe("Today, 14:15");
  });
});

describe("kiritma turlari", () => {
  it("mintaqasiz ISO satr — mahalliy vaqt (dayjs bilan bir xil)", () => {
    expect(formatDateLocalized("2026-10-06")).toBe("06.10.2026");
    expect(formatDateTimeLocalized("2026-10-06T19:05:00", { now: NOW })).toBe("06.10.2026, 19:05");
    expect(formatDateTimeLocalized("2026-10-06 19:05", { now: NOW })).toBe("06.10.2026, 19:05");
    expect(formatDateTimeLocalized("2026-10-07T18:04:30.123456", { now: NOW, language: "uz" })).toBe("Kecha, 18:04");
  });

  it("`Z` va siljishli ISO — aniq lahza, mahalliy vaqtda ko'rsatiladi", () => {
    const local = (iso: string) => {
      const date = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    for (const iso of ["2026-10-06T14:05:00Z", "2026-10-06T14:05:00.000Z", "2026-10-06T19:05:00+05:00", "2026-10-06T09:05:00-05:00"]) {
      expect(formatDateTimeLocalized(iso, { relative: false })).toBe(local(iso));
    }
    // Siljishning ixcham shakllari bir xil lahzani beradi.
    const instant = toValidDate("2026-10-06T19:05:00+05:00")?.getTime();
    expect(toValidDate("2026-10-06T19:05:00+0500")?.getTime()).toBe(instant);
    expect(toValidDate("2026-10-06T19:05:00+05")?.getTime()).toBe(instant);
    expect(toValidDate("2026-10-06T14:05:00z")?.getTime()).toBe(instant);
  });

  it("millisekund (epoch) va `Date`", () => {
    const date = at(2026, 10, 6, 19, 5);
    expect(formatDateTimeLocalized(date.getTime(), { now: NOW })).toBe("06.10.2026, 19:05");
    expect(formatDateTimeLocalized(date, { now: NOW })).toBe("06.10.2026, 19:05");
  });

  it("ilovaning o'z ko'rinishi (KK.OO.YYYY) OO.KK deb o'qilmaydi", () => {
    expect(formatDateLocalized("06.10.2026")).toBe("06.10.2026");
    expect(formatDateTimeLocalized("06.10.2026, 19:05", { now: NOW })).toBe("06.10.2026, 19:05");
    expect(formatDateTimeLocalized("07.10.2026 18:04", { now: NOW, language: "uz" })).toBe("Kecha, 18:04");
  });

  it("harfli satr brauzerga beriladi", () => {
    const rfc = "Tue, 06 Oct 2026 14:05:00 GMT";
    expect(toValidDate(rfc)?.getTime()).toBe(Date.UTC(2026, 9, 6, 14, 5));
  });

  it("bo'sh va noto'g'ri qiymat → «—»", () => {
    const invalid: unknown[] = [
      undefined,
      null,
      "",
      "   ",
      "abc",
      "not a date",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      new Date(Number.NaN),
      "2026-02-30",
      "2026-13-01",
      "2026-10-06T25:00",
      "31.09.2026",
      "29.02.2026",
      "10/06/2026",
      "1728230700000",
      {},
      true,
    ];
    for (const value of invalid) {
      const input = value as Parameters<typeof formatDateTimeLocalized>[0];
      expect(formatDateLocalized(input)).toBe("—");
      expect(formatTimeLocalized(input)).toBe("—");
      expect(formatDateTimeLocalized(input, { now: NOW })).toBe("—");
    }
  });

  it("kabisa yilidagi 29.02 qabul qilinadi", () => {
    expect(formatDateLocalized("2028-02-29")).toBe("29.02.2028");
    expect(formatDateLocalized("29.02.2028")).toBe("29.02.2028");
  });

  it("noto'g'ri `now` — joriy vaqtga qaytadi, xato bermaydi", () => {
    expect(formatDateTimeLocalized(at(2020, 1, 1, 10, 0), { now: Number.NaN, language: "uz" })).toBe("01.01.2020, 10:00");
  });

  it("asl `Date` o'zgartirilmaydi", () => {
    const date = at(2026, 10, 6, 19, 5);
    const copy = toValidDate(date);
    copy?.setFullYear(1999);
    expect(date.getFullYear()).toBe(2026);
  });
});

describe("RELATIVE_DAY_LABEL", () => {
  it("uchala tilda, maketdagi yozuv bilan", () => {
    expect(RELATIVE_DAY_LABEL).toEqual({
      uz: { today: "Bugun", yesterday: "Kecha" },
      ru: { today: "Сегодня", yesterday: "Вчера" },
      en: { today: "Today", yesterday: "Yesterday" },
    });
  });
});

/**
 * Yozgi vaqt: kun 23 yoki 25 soat. Toshkentda yozgi vaqt yo'q, shuning uchun mintaqa
 * shu describe uchungina Yevropa/Berlinga o'zgartiriladi (Node `process.env.TZ` ni
 * darhol qo'llaydi) va oxirida qaytariladi.
 */
/** Ilova tsconfig'ida Node tiplari yo'q; testda faqat `process.env.TZ` kerak. */
declare const process: { env: Record<string, string | undefined> };

describe("yozgi vaqtga o'tish (Europe/Berlin)", () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Berlin";
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("mintaqa haqiqatan almashdi (aks holda test hech narsani tekshirmaydi)", () => {
    // 29.03.2026 — 23 soatlik kun (02:00 → 03:00).
    expect(at(2026, 3, 30).getTime() - at(2026, 3, 29).getTime()).toBe(23 * 3_600_000);
  });

  it("23 soatlik kundan keyin: 24 soatlik oyna «kecha» deb adashadigan sana to'liq ko'rsatiladi", () => {
    const now = at(2026, 3, 30, 0, 30);
    expect(formatDateTimeLocalized(at(2026, 3, 29, 0, 15), { now, language: "uz" })).toBe("Kecha, 00:15");
    // 30.03 00:00 − 24 soat = 28.03 23:00 (kun 23 soat edi) — lekin 28.03 kecha emas.
    expect(formatDateTimeLocalized(at(2026, 3, 28, 23, 30), { now, language: "uz" })).toBe("28.03.2026, 23:30");
  });

  it("25 soatlik kun (25.10.2026, 03:00 → 02:00)", () => {
    expect(at(2026, 10, 26).getTime() - at(2026, 10, 25).getTime()).toBe(25 * 3_600_000);
    const now = at(2026, 10, 26, 0, 30);
    expect(formatDateTimeLocalized(at(2026, 10, 25, 0, 10), { now, language: "en" })).toBe("Yesterday, 00:10");
    expect(formatDateTimeLocalized(at(2026, 10, 24, 23, 50), { now, language: "en" })).toBe("24.10.2026, 23:50");
    expect(formatDateTimeLocalized(at(2026, 10, 26, 0, 5), { now, language: "en" })).toBe("Today, 00:05");
  });
});
