import { describe, expect, it } from "vitest";
import { chosenOperatorId, isOperatorRejectedResult } from "./aiOperator";

/**
 * AI kartasidagi «Operator» tanlovi — eskirgan tanlov va rad etilgan natija (taklif — `operatorMatch.test.ts`).
 */

const OPERATORS = [
  { id: "31", name: "Sevinch Karimova" },
  { id: "32", name: "Bekzod Aliyev" },
  { id: "33", name: "Bekzod Nurmatov" },
  { id: "34", name: "O‘g‘iloy" },
];

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
