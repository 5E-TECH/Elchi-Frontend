import { describe, expect, it } from "vitest";
import { canAssignOrderOperator, isOwnMarketRole, readOrderOperatorErrorCode } from "./assignOperatorRules";

/**
 * 2026-11-16: «operator tanlanmasa shu buyurtmaga operator biriktirib qo'yish imkoni bo'lishi kerak» — tugma qachon
 * chiqadi. Backend `PUT /orders/:id/operator` rollari bilan AYNI; operator bor / integratsiya / marketsiz — yo'q.
 */
const free = { operatorId: null, operatorExternal: false, marketId: "37" };

describe("canAssignOrderOperator", () => {
  it.each(["superadmin", "admin", "registrator", "manager", "branch", "market", "SUPERADMIN"])(
    "⭐ %s — operatori yo'q buyurtmaga biriktira oladi",
    (role) => {
      expect(canAssignOrderOperator(role, free)).toBe(true);
    },
  );

  it.each(["market_operator", "courier", "operator", "investor", "", null, undefined])("%s — yo'q", (role) => {
    expect(canAssignOrderOperator(role, free)).toBe(false);
  });

  it("⭐ operator bor — yo'q (almashtirish emas, biriktirish)", () => {
    expect(canAssignOrderOperator("admin", { ...free, operatorId: "412" })).toBe(false);
  });

  it("integratsiya buyurtmasi yoki marketsiz — yo'q", () => {
    expect(canAssignOrderOperator("admin", { ...free, operatorExternal: true })).toBe(false);
    expect(canAssignOrderOperator("admin", { ...free, marketId: null })).toBe(false);
    expect(canAssignOrderOperator("admin", null)).toBe(false);
  });
});

describe("yordamchilar", () => {
  it("market roli ro'yxatni o'z tokenidan oladi", () => {
    expect(isOwnMarketRole("market")).toBe(true);
    expect(isOwnMarketRole("admin")).toBe(false);
  });

  it("409 kodlari — faqat biriktirish kodlari o'qiladi", () => {
    const err = (data: unknown) => ({ response: { status: 409, data } });
    expect(readOrderOperatorErrorCode(err({ code: "ORDER_OPERATOR_ALREADY_ASSIGNED" }))).toBe(
      "ORDER_OPERATOR_ALREADY_ASSIGNED",
    );
    expect(readOrderOperatorErrorCode(err({ data: { code: "ORDER_OPERATOR_MARKET_CHANGED" } }))).toBe(
      "ORDER_OPERATOR_MARKET_CHANGED",
    );
    expect(readOrderOperatorErrorCode(err({ code: "SOMETHING_ELSE" }))).toBeNull();
    expect(readOrderOperatorErrorCode(new Error("x"))).toBeNull();
    expect(readOrderOperatorErrorCode(null)).toBeNull();
  });
});
