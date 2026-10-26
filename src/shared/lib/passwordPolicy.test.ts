import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import {
  checkPasswordPolicy,
  getPasswordPolicyServerMessage,
  passwordMinLength,
  PASSWORD_MIN_LENGTH,
  STAFF_PASSWORD_MIN_LENGTH,
} from "./passwordPolicy";

const axiosError = (status: number, data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("passwordPolicy (NDmZMzCP — backend libs/common/src/security/password-policy.ts)", () => {
  it("xodimlar (kuryer ham) — 10, market / market operatori / investor / mijoz / noma'lum — 8", () => {
    for (const role of ["superadmin", "admin", "manager", "registrator", "operator", "logist", "branch", "courier", "COURIER"]) {
      expect(passwordMinLength(role)).toBe(STAFF_PASSWORD_MIN_LENGTH);
    }
    for (const role of ["market", "marketing", "market_operator", "investor", "customer", null, undefined, ""]) {
      expect(passwordMinLength(role)).toBe(PASSWORD_MIN_LENGTH);
    }
  });

  it("bo'sh, qisqa, chekka bo'shliq va 72 baytdan uzun parol rad etiladi", () => {
    expect(checkPasswordPolicy("", "courier")).toBe("required");
    expect(checkPasswordPolicy("    ", "market")).toBe("required");
    expect(checkPasswordPolicy("Namuna123", "courier")).toBe("tooShort"); // 9 < 10
    expect(checkPasswordPolicy("Namuna123", "market")).toBeNull(); // 9 ≥ 8
    expect(checkPasswordPolicy("Nam1234", "market")).toBe("tooShort");
    expect(checkPasswordPolicy(" Namuna1234", "admin")).toBe("edgeSpaces");
    expect(checkPasswordPolicy("Namuna1234 ", "admin")).toBe("edgeSpaces");
    expect(checkPasswordPolicy("o'".repeat(30) + "ўўўўўўўў", "admin")).toBe("tooLong");
    expect(checkPasswordPolicy("Kuchli-Parol-2026", "superadmin")).toBeNull();
  });

  it("server 400 parol xabari maydon uchun olinadi, boshqa xato — yo'q", () => {
    expect(
      getPasswordPolicyServerMessage(
        axiosError(400, { statusCode: 400, message: ["Parol kamida 10 belgidan iborat bo'lishi kerak"] }),
      ),
    ).toBe("Parol kamida 10 belgidan iborat bo'lishi kerak");
    expect(
      getPasswordPolicyServerMessage(axiosError(400, { message: "Parol juda oddiy — boshqa parol tanlang" })),
    ).toBe("Parol juda oddiy — boshqa parol tanlang");
    expect(getPasswordPolicyServerMessage(axiosError(400, { message: "Telefon raqam noto'g'ri" }))).toBeUndefined();
    expect(getPasswordPolicyServerMessage(axiosError(409, { message: "Parol band" }))).toBeUndefined();
    expect(getPasswordPolicyServerMessage(new Error("x"))).toBeUndefined();
  });
});
