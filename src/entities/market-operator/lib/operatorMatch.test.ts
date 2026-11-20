import { describe, expect, it } from "vitest";
import { normalizeOperatorName, suggestOperator } from "./operatorMatch";

/**
 * Yozilgan / AI o'qigan ism → ro'yxatdagi operator TAKLIFI (avtomatik tanlanmaydi). AI kartasi va qo'lda forma.
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
