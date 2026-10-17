import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import {
  EXTRA_COST_REJECT_REASONS,
  canDecideExtraCost,
  isExtraCostAlreadyDecidedError,
} from "./extraCostDecision";

const httpError = (status: number, message: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

describe("extraCostDecision (DuST9k8j, 1tnpaIqd)", () => {
  it("rad etish sabablari — backend yopiq ro'yxati", () => {
    expect(EXTRA_COST_REJECT_REASONS).toEqual(["TOO_EXPENSIVE", "NOT_AGREED", "NO_PROOF", "DUPLICATE"]);
  });

  it("qarorni market egasi va admin/superadmin qiladi, market operatori — yo'q", () => {
    expect(canDecideExtraCost("market")).toBe(true);
    expect(canDecideExtraCost("admin")).toBe(true);
    expect(canDecideExtraCost("superadmin")).toBe(true);
    expect(canDecideExtraCost("market_operator")).toBe(false);
    expect(canDecideExtraCost("courier")).toBe(false);
    expect(canDecideExtraCost(null)).toBe(false);
  });

  it("allaqachon hal qilingan: 409 yoki backend «allaqachon yakunlangan» (400)", () => {
    expect(isExtraCostAlreadyDecidedError(httpError(409, "Conflict"))).toBe(true);
    expect(isExtraCostAlreadyDecidedError(httpError(400, "Bu so'rov allaqachon yakunlangan"))).toBe(true);
    expect(isExtraCostAlreadyDecidedError(httpError(400, ["Bu so'rov allaqachon yakunlangan"]))).toBe(true);
  });

  it("boshqa xatolar — oddiy xato", () => {
    expect(isExtraCostAlreadyDecidedError(httpError(400, "Rad etish sababi noto'g'ri (yopiq ro'yxatdan tanlang)"))).toBe(false);
    expect(isExtraCostAlreadyDecidedError(httpError(403, "Bu qo'shimcha xarajat so'rovini tasdiqlash mumkin emas"))).toBe(false);
    expect(isExtraCostAlreadyDecidedError(new Error("allaqachon yakunlangan"))).toBe(false);
    expect(isExtraCostAlreadyDecidedError(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(false);
  });
});
