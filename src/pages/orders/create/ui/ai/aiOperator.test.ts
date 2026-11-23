import { describe, expect, it } from "vitest";
import type { AiDraft } from "./aiDraft";
import { autoPickOperators, chosenOperatorId, confirmOperatorFields, isOperatorRejectedResult } from "./aiOperator";

/**
 * AI kartasidagi «Operator» tanlovi — avto-tanlov, eskirgan tanlov va rad etilgan natija (moslik — `operatorMatch.test.ts`).
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

describe("confirmOperatorFields (2026-11-21: ro'yxat bor — erkin matn yo'q)", () => {
  const LIST = [{ id: "31", name: "Sevinch Karimova" }];

  it("tanlangan — id va ismi", () => {
    expect(confirmOperatorFields({ operator_id: "31", operator: "Sevinch Karimova" }, LIST)).toEqual({
      operator_id: "31",
      operator: "Sevinch Karimova",
    });
  });

  it("ro'yxat bor, tanlanmagan — operatorsiz: AI o'qigan ism ham yuborilmaydi", () => {
    expect(confirmOperatorFields({ operator_id: null, operator: "#sevinch" }, LIST)).toEqual({
      operator_id: null,
      operator: "",
    });
    // Eskirgan tanlov (ro'yxatda yo'q) — xuddi shunday.
    expect(confirmOperatorFields({ operator_id: "99", operator: "Eski" }, LIST)).toEqual({ operator_id: null, operator: "" });
  });

  it("ro'yxat yo'q / bo'sh — kartadagi matn avvalgidek", () => {
    expect(confirmOperatorFields({ operator_id: null, operator: "Kamola" }, undefined)).toEqual({
      operator_id: null,
      operator: "Kamola",
    });
    expect(confirmOperatorFields({ operator_id: null, operator: "Kamola" }, [])).toEqual({ operator_id: null, operator: "Kamola" });
  });
});

describe("autoPickOperators (ega, 2026-11-23: mos operator so'ramasdan tanlanadi)", () => {
  const draft = (key: string, order: { operator?: string; operator_id?: string | null }, extra: Partial<AiDraft> = {}) =>
    ({ key, order: { operator: "", operator_id: null, ...order }, source: {}, ...extra }) as unknown as AiDraft;

  it("yagona mos — id va ro'yxatdagi ismi qo'yiladi; hamma karta belgilanadi", () => {
    const [a, b, c] = autoPickOperators(
      [draft("a", { operator: "sevinch" }), draft("b", { operator: "Shahzoda" }), draft("c", { operator: "bekzod" })],
      OPERATORS,
    );
    expect(a.order).toMatchObject({ operator_id: "31", operator: "Sevinch Karimova" });
    // Ro'yxatda yo'q va noaniq («bekzod» — ikkita Bekzod) — tegilmaydi.
    expect(b.order).toMatchObject({ operator_id: null, operator: "Shahzoda" });
    expect(c.order).toMatchObject({ operator_id: null, operator: "bekzod" });
    expect([a, b, c].every((item) => item.operatorAutoChecked)).toBe(true);
  });

  it("allaqachon tanlangan yoki solishtirilgan karta tegilmaydi (odam «Tanlanmagan» qilgan bo'lsa ham)", () => {
    const picked = draft("p", { operator: "Bekzod Aliyev", operator_id: "33" });
    const cleared = draft("x", { operator: "sevinch", operator_id: null }, { operatorAutoChecked: true });
    const [p, x] = autoPickOperators([picked, cleared], OPERATORS);
    expect(p.order.operator_id).toBe("33");
    expect(p.operatorAutoChecked).toBe(true);
    expect(x).toBe(cleared);
  });
});
