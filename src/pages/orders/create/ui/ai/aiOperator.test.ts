import { describe, expect, it } from "vitest";
import { chosenOperatorId, isOperatorRejectedResult, normalizeOperatorName, suggestOperator } from "./aiOperator";

/**
 * AI kartasidagi «Operator» tanlovi — taklif (avtomatik EMAS), eskirgan tanlov va rad etilgan natija.
 */

const OPERATORS = [
  { id: "31", name: "Sevinch Karimova" },
  { id: "32", name: "Bekzod Aliyev" },
  { id: "33", name: "Bekzod Nurmatov" },
  { id: "34", name: "O‘g‘iloy" },
];

describe("normalizeOperatorName", () => {
  it("`#`, katta-kichik harf, tutuq belgisi turlari va bo'shliqlar farq qilmaydi", () => {
    expect(normalizeOperatorName("  ##Sevinch   KARIMOVA ")).toBe("sevinch karimova");
    expect(normalizeOperatorName("O‘g‘iloy")).toBe(normalizeOperatorName("o'g'iloy"));
    expect(normalizeOperatorName(null)).toBe("");
  });
});

describe("suggestOperator", () => {
  it("to'liq ism mos — o'sha operator", () => {
    expect(suggestOperator("sevinch karimova", OPERATORS)).toEqual(OPERATORS[0]);
    expect(suggestOperator("#o'g'iloy", OPERATORS)).toEqual(OPERATORS[3]);
  });

  it("bitta so'z — ismi shu so'z bilan boshlanadigan YAGONA operator", () => {
    expect(suggestOperator("#sevinch", OPERATORS)).toEqual(OPERATORS[0]);
  });

  it("bir nechta mos (ikki «Bekzod») yoki hech biri — taklif yo'q", () => {
    expect(suggestOperator("Bekzod", OPERATORS)).toBeNull();
    expect(suggestOperator("Shahzoda", OPERATORS)).toBeNull();
    // To'liq ism berilgan, lekin ro'yxatda aynan yo'q — ism bo'yicha taxmin qilinmaydi.
    expect(suggestOperator("Sevinch Aliyeva", OPERATORS)).toBeNull();
  });

  it("bo'sh matn yoki ro'yxat — taklif yo'q", () => {
    expect(suggestOperator("", OPERATORS)).toBeNull();
    expect(suggestOperator("Sevinch", [])).toBeNull();
    expect(suggestOperator("Sevinch", undefined)).toBeNull();
  });
});

describe("chosenOperatorId", () => {
  it("ro'yxatda bor — tanlov; yo'q (market almashgan / operator o'chirilgan) — bo'sh", () => {
    expect(chosenOperatorId({ operator_id: "31" }, OPERATORS)).toBe("31");
    expect(chosenOperatorId({ operator_id: "99" }, OPERATORS)).toBe("");
  });

  it("ro'yxat hali yo'q (yuklanmoqda / xato) — tanlov saqlanadi, uni backend tekshiradi", () => {
    expect(chosenOperatorId({ operator_id: "99" }, undefined)).toBe("99");
  });

  it("tanlanmagan — bo'sh", () => {
    expect(chosenOperatorId({ operator_id: null }, OPERATORS)).toBe("");
    expect(chosenOperatorId({}, OPERATORS)).toBe("");
  });
});

describe("isOperatorRejectedResult", () => {
  it("`reason_code` CHOSEN_OPERATOR_* yoki (kodsiz eski javob) backend matni — rad etilgan", () => {
    expect(
      isOperatorRejectedResult({ ok: false, reason_code: "CHOSEN_OPERATOR_NOT_SELECTABLE", reason: "…" }),
    ).toBe(true);
    expect(
      isOperatorRejectedResult({ ok: false, reason: "Tanlangan operator bu marketga tegishli emas yoki faol emas" }),
    ).toBe(true);
  });

  it("boshqa xato va muvaffaqiyatli natija — yo'q", () => {
    expect(isOperatorRejectedResult({ ok: false, reason: "Buyurtma uchun tuman tanlanmagan" })).toBe(false);
    expect(isOperatorRejectedResult({ ok: true })).toBe(false);
  });
});
