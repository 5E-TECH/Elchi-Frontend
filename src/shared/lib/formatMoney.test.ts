import { describe, expect, it } from "vitest";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
  formatUsdLocalized,
  MINUS_SIGN,
  resolveMoneyLanguage,
} from "./formatMoney";
import uzOrders from "../../locales/uz/orders.json";
import ruOrders from "../../locales/ru/orders.json";
import enOrders from "../../locales/en/orders.json";
import uzPayments from "../../locales/uz/payments.json";
import ruPayments from "../../locales/ru/payments.json";
import enPayments from "../../locales/en/payments.json";

/**
 * PUL FORMATI — dizayn v2 qoidasi: uz "so'm", ru "сум", en "UZS".
 * Ilgari bir ekranning o'zida ru'da "сум" ham "UZS" ham, en'da "sum",
 * "so'm" ham "UZS" ham chiqardi (10 ta turli kalit).
 */
describe("formatMoneyLocalized", () => {
  it("uchala tilda to'g'ri ajratkich va valyuta", () => {
    expect(formatMoneyLocalized(185000, { language: "uz" })).toBe("185 000 so'm");
    expect(formatMoneyLocalized(185000, { language: "ru" })).toBe("185 000 сум");
    expect(formatMoneyLocalized(185000, { language: "en" })).toBe("185,000 UZS");
  });

  it("butun so'mga yaxlitlaydi, manfiy va nolni to'g'ri chiqaradi", () => {
    expect(formatMoneyLocalized(1545000.6, { language: "uz" })).toBe("1 545 001 so'm");
    expect(formatMoneyLocalized(-13458000, { language: "uz" })).toBe("−13 458 000 so'm");
    expect(formatMoneyLocalized(0, { language: "en" })).toBe("0 UZS");
    expect(formatMoneyLocalized(-0.4, { language: "uz" })).toBe("0 so'm");
  });

  it("noto'g'ri qiymat 0 bo'ladi, satr son qabul qilinadi (xom SQL numeric satr qaytaradi)", () => {
    expect(formatMoneyLocalized(undefined, { language: "uz" })).toBe("0 so'm");
    expect(formatMoneyLocalized("abc", { language: "ru" })).toBe("0 сум");
    expect(formatMoneyLocalized("95348635.57", { language: "uz" })).toBe("95 348 636 so'm");
  });

  it("withCurrency: false — faqat raqam", () => {
    expect(formatMoneyLocalized(185000, { language: "uz", withCurrency: false })).toBe("185 000");
  });

  it("⭐ brauzer ICU'siga bog'liq emas (Chrome'da uz yo'q — vergul chiqmasin)", () => {
    expect(formatNumberLocalized(1545000, { language: "uz" })).not.toContain(",");
    expect(formatNumberLocalized(1545000, { language: "uz" })).toBe("1 545 000");
  });
});

describe("⭐ manfiy son — haqiqiy minus U+2212 (maket «Format standarti»: «−240 000 so'm»)", () => {
  it("MINUS_SIGN — U+2212, chiziqcha emas", () => {
    expect(MINUS_SIGN).toBe("\u2212");
    expect(MINUS_SIGN).not.toBe("-");
  });

  it("pul, son, ixcham va foizda uchala tilda U+2212; chiziqcha '-' hech qayerda yo'q", () => {
    const outputs = (["uz", "ru", "en"] as const).flatMap((language) => [
      formatMoneyLocalized(-240_000, { language }),
      formatNumberLocalized(-1_545_000.5, { language, fractionDigits: 1 }),
      formatCompactMoneyLocalized(-48_600_000, { language }),
      formatCompactMoneyLocalized(-950, { language }),
      formatPercentLocalized(-6.2, { language }),
    ]);
    for (const text of outputs) {
      expect(text.startsWith(MINUS_SIGN)).toBe(true);
      expect(text).not.toContain("-");
    }
    expect(formatMoneyLocalized(-240_000, { language: "uz" })).toBe("−240 000 so'm");
    expect(formatMoneyLocalized(-240_000, { language: "ru" })).toBe("−240 000 сум");
    expect(formatMoneyLocalized(-240_000, { language: "en" })).toBe("−240,000 UZS");
    expect(formatCompactMoneyLocalized(-1_200_000_000, { language: "en" })).toBe("−1.2B UZS");
  });

  it("yaxlitlab nol bo'lsa — minussiz '0' ('−0' emas)", () => {
    expect(formatNumberLocalized(-0.04, { language: "uz", fractionDigits: 1 })).toBe("0");
    expect(formatNumberLocalized(-0, { language: "uz" })).toBe("0");
    expect(formatCompactMoneyLocalized(-0.4, { language: "uz" })).toBe("0 so'm");
    expect(formatPercentLocalized(-0.01, { language: "uz" })).toBe("0%");
  });
});

describe("formatSignedMoneyLocalized — kirim '+', chiqim/qarz '−'", () => {
  it("maketdagi qatorlar uchala tilda", () => {
    expect(formatSignedMoneyLocalized(120_000, { language: "uz" })).toBe("+120 000 so'm");
    expect(formatSignedMoneyLocalized(120_000, { language: "ru" })).toBe("+120 000 сум");
    expect(formatSignedMoneyLocalized(120_000, { language: "en" })).toBe("+120,000 UZS");
    expect(formatSignedMoneyLocalized(-240_000, { language: "uz" })).toBe("−240 000 so'm");
    expect(formatSignedMoneyLocalized(-240_000, { language: "ru" })).toBe("−240 000 сум");
    expect(formatSignedMoneyLocalized(-240_000, { language: "en" })).toBe("−240,000 UZS");
  });

  it("nol — ishorasiz; yaxlitlab nolga tushsa ham", () => {
    expect(formatSignedMoneyLocalized(0, { language: "uz" })).toBe("0 so'm");
    expect(formatSignedMoneyLocalized(0.4, { language: "uz" })).toBe("0 so'm");
    expect(formatSignedMoneyLocalized(-0.4, { language: "uz" })).toBe("0 so'm");
  });

  it("butun so'mga yaxlitlaydi; satr son va noto'g'ri qiymat", () => {
    expect(formatSignedMoneyLocalized(0.6, { language: "uz" })).toBe("+1 so'm");
    expect(formatSignedMoneyLocalized("185000.4", { language: "uz" })).toBe("+185 000 so'm");
    expect(formatSignedMoneyLocalized("-95348635.57", { language: "uz" })).toBe("−95 348 636 so'm");
    expect(formatSignedMoneyLocalized(undefined, { language: "ru" })).toBe("0 сум");
    expect(formatSignedMoneyLocalized(Number.NaN, { language: "en" })).toBe("0 UZS");
  });

  it("withCurrency: false — faqat ishorali raqam", () => {
    expect(formatSignedMoneyLocalized(185_000, { language: "uz", withCurrency: false })).toBe("+185 000");
    expect(formatSignedMoneyLocalized(-185_000, { language: "en", withCurrency: false })).toBe("−185,000");
  });
});

describe("formatCompactMoneyLocalized", () => {
  it("mln / млн / M", () => {
    expect(formatCompactMoneyLocalized(48_600_000, { language: "uz" })).toBe("48,6 mln so'm");
    expect(formatCompactMoneyLocalized(48_600_000, { language: "ru" })).toBe("48,6 млн сум");
    expect(formatCompactMoneyLocalized(48_600_000, { language: "en" })).toBe("48.6M UZS");
  });

  it("ming / тыс. / K va mlrd / млрд / B", () => {
    expect(formatCompactMoneyLocalized(1_500, { language: "uz" })).toBe("1,5 ming so'm");
    expect(formatCompactMoneyLocalized(1_500, { language: "ru" })).toBe("1,5 тыс. сум");
    expect(formatCompactMoneyLocalized(1_500, { language: "en" })).toBe("1.5K UZS");
    expect(formatCompactMoneyLocalized(2_300_000_000, { language: "uz" })).toBe("2,3 mlrd so'm");
    expect(formatCompactMoneyLocalized(2_300_000_000, { language: "en" })).toBe("2.3B UZS");
  });

  it("butun natijada ortiqcha ',0' yozilmaydi; 1000 dan kichik summa to'liq", () => {
    expect(formatCompactMoneyLocalized(5_000_000, { language: "uz" })).toBe("5 mln so'm");
    expect(formatCompactMoneyLocalized(950, { language: "uz" })).toBe("950 so'm");
  });

  it("⭐ pog'ona chegarasi: 999 950 → '1 mln', '1000 ming' emas", () => {
    expect(formatCompactMoneyLocalized(999_950, { language: "uz" })).toBe("1 mln so'm");
    // 1000 dan sal kichik: butunga yaxlitlab 1000 bo'lsa — "1000 so'm" emas, "1 ming".
    expect(formatCompactMoneyLocalized(999.6, { language: "uz" })).toBe("1 ming so'm");
    expect(formatCompactMoneyLocalized(-999.6, { language: "en" })).toBe("\u22121K UZS");
    expect(formatCompactMoneyLocalized(999.4, { language: "uz" })).toBe("999 so'm");
    expect(formatCompactMoneyLocalized(-13_458_000, { language: "uz", withCurrency: false })).toBe("−13,5 mln");
  });
});

describe("valyuta kalitlari locale JSON'da bir xil", () => {
  it("resolveMoneyLanguage noma'lum tilni uz deb oladi", () => {
    expect(resolveMoneyLanguage("ru-RU")).toBe("ru");
    expect(resolveMoneyLanguage("de")).toBe("uz");
  });

  it("⭐ orders.currency va payments.currency — uz so'm / ru сум / en UZS", () => {
    expect([uzOrders.currency, ruOrders.currency, enOrders.currency]).toEqual([
      CURRENCY_LABEL.uz,
      CURRENCY_LABEL.ru,
      CURRENCY_LABEL.en,
    ]);
    expect([uzPayments.currency, ruPayments.currency, enPayments.currency]).toEqual([
      CURRENCY_LABEL.uz,
      CURRENCY_LABEL.ru,
      CURRENCY_LABEL.en,
    ]);
  });
});

describe("formatPercentLocalized", () => {
  it("⭐ maket «Format standarti»: uz '8,2%' · ru '8,2 %' (bo'linmas bo'sh joy) · en '8.2%'", () => {
    expect(formatPercentLocalized(8.2, { language: "uz" })).toBe("8,2%");
    expect(formatPercentLocalized(8.2, { language: "ru" })).toBe("8,2\u00a0%");
    expect(formatPercentLocalized(8.2, { language: "en" })).toBe("8.2%");
    // Oddiy bo'sh joy emas — tor katakda «8,2» va «%» alohida qatorga tushmasin.
    expect(formatPercentLocalized(8.2, { language: "ru" })).not.toContain(" ");
    expect(formatPercentLocalized(-6.2, { language: "ru" })).toBe("−6,2\u00a0%");
  });

  it("locale ajratkichi, 1 xona sukut, ortiqcha nolsiz", () => {
    expect(formatPercentLocalized(67.43, { language: "uz" })).toBe("67,4%");
    expect(formatPercentLocalized(67.43, { language: "ru" })).toBe("67,4\u00a0%");
    expect(formatPercentLocalized(67.43, { language: "en" })).toBe("67.4%");
    expect(formatPercentLocalized(50, { language: "uz" })).toBe("50%");
    expect(formatPercentLocalized(12.345, { language: "uz", fractionDigits: 2 })).toBe("12,35%");
    expect(formatPercentLocalized(null, { language: "uz" })).toBe("0%");
  });
});

describe("⭐ formatUsdLocalized — dollar (S4): doim 2 kasr, «12,40 $»", () => {
  it("uz/ru — belgi oxirida, vergul kasr; en — «$12.40»", () => {
    expect(formatUsdLocalized(12.4, { language: "uz" })).toBe("12,40 $");
    expect(formatUsdLocalized(12.4, { language: "ru" })).toBe("12,40 $");
    expect(formatUsdLocalized(12.4, { language: "en" })).toBe("$12.40");
  });

  it("nollar saqlanadi, 2 xonaga yaxlitlanadi", () => {
    expect(formatUsdLocalized(25, { language: "uz" })).toBe("25,00 $");
    expect(formatUsdLocalized(0, { language: "uz" })).toBe("0,00 $");
    expect(formatUsdLocalized(5.8249, { language: "uz" })).toBe("5,82 $");
    expect(formatUsdLocalized(29.399, { language: "en" })).toBe("$29.40");
  });

  it("mingliklar ajratkichi tildan", () => {
    expect(formatUsdLocalized(1234.5, { language: "uz" })).toBe("1 234,50 $");
    expect(formatUsdLocalized(1234.5, { language: "ru" })).toBe("1 234,50 $");
    expect(formatUsdLocalized(1234567.891, { language: "en" })).toBe("$1,234,567.89");
  });

  it("manfiy — U+2212; yaxlitlab nol — minussiz; son bo'lmasa — 0", () => {
    expect(formatUsdLocalized(-3.5, { language: "uz" })).toBe(`${MINUS_SIGN}3,50 $`);
    expect(formatUsdLocalized(-3.5, { language: "en" })).toBe(`${MINUS_SIGN}$3.50`);
    expect(formatUsdLocalized(-0.001, { language: "uz" })).toBe("0,00 $");
    expect(formatUsdLocalized("7.1", { language: "uz" })).toBe("7,10 $");
    expect(formatUsdLocalized(undefined, { language: "uz" })).toBe("0,00 $");
    expect(formatUsdLocalized(Number.NaN, { language: "ru" })).toBe("0,00 $");
  });

  it("mavjud so'm formatlovchilari o'zgarmagan", () => {
    expect(formatMoneyLocalized(185000, { language: "uz" })).toBe("185 000 so'm");
    expect(formatNumberLocalized(12.4, { language: "uz", fractionDigits: 2 })).toBe("12,4");
  });
});

describe("formatNumberLocalized — minFractionDigits (og'irlik: «7,0 kg»)", () => {
  it("nollar olib tashlangandan keyin ham kamida N xona qoladi", () => {
    expect(formatNumberLocalized(7, { language: "uz", fractionDigits: 2, minFractionDigits: 1 })).toBe("7,0");
    expect(formatNumberLocalized(1.98, { language: "uz", fractionDigits: 2, minFractionDigits: 1 })).toBe("1,98");
    expect(formatNumberLocalized(3.6, { language: "ru", fractionDigits: 2, minFractionDigits: 1 })).toBe("3,6");
    expect(formatNumberLocalized(2, { language: "en", fractionDigits: 1, minFractionDigits: 1 })).toBe("2.0");
    expect(formatNumberLocalized(1250.5, { language: "uz", minFractionDigits: 1 })).toBe("1 250,5");
  });

  it("berilmasa — avvalgidek (ortiqcha nollarsiz)", () => {
    expect(formatNumberLocalized(7, { language: "uz", fractionDigits: 2 })).toBe("7");
    expect(formatNumberLocalized(-0.04, { language: "uz", fractionDigits: 1, minFractionDigits: 1 })).toBe("0,0");
  });
});
