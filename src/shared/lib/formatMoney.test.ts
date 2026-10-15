import { describe, expect, it } from "vitest";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
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
    expect(formatMoneyLocalized(-13458000, { language: "uz" })).toBe("-13 458 000 so'm");
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
    expect(formatCompactMoneyLocalized(-13_458_000, { language: "uz", withCurrency: false })).toBe("-13,5 mln");
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
  it("locale ajratkichi, 1 xona sukut, ortiqcha nolsiz", () => {
    expect(formatPercentLocalized(67.43, { language: "uz" })).toBe("67,4%");
    expect(formatPercentLocalized(67.43, { language: "ru" })).toBe("67,4%");
    expect(formatPercentLocalized(67.43, { language: "en" })).toBe("67.4%");
    expect(formatPercentLocalized(50, { language: "uz" })).toBe("50%");
    expect(formatPercentLocalized(12.345, { language: "uz", fractionDigits: 2 })).toBe("12,35%");
    expect(formatPercentLocalized(null, { language: "uz" })).toBe("0%");
  });
});
