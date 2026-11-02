import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import {
  checkPasswordPolicy,
  getPasswordPolicyServerMessage,
  PASSWORD_MIN_LENGTH,
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
  it("ega qarori 2026-11-02: hamma rol uchun kamida 6 belgi", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
    expect(checkPasswordPolicy("Nam12")).toBe("tooShort");
    expect(checkPasswordPolicy("Nam123")).toBeNull();
  });

  it("bo'sh, qisqa, chekka bo'shliq va 72 baytdan uzun parol rad etiladi", () => {
    expect(checkPasswordPolicy("")).toBe("required");
    expect(checkPasswordPolicy("    ")).toBe("required");
    expect(checkPasswordPolicy(" Namuna1234")).toBe("edgeSpaces");
    expect(checkPasswordPolicy("Namuna1234 ")).toBe("edgeSpaces");
    expect(checkPasswordPolicy("o'".repeat(30) + "ўўўўўўўў")).toBe("tooLong");
    expect(checkPasswordPolicy("Kuchli-Parol-2026")).toBeNull();
  });

  it("katta harf, kichik harf va raqam majburiy (kirill harfi ham harf)", () => {
    expect(checkPasswordPolicy("namuna12")).toBe("noUpper");
    expect(checkPasswordPolicy("NAMUNA12")).toBe("noLower");
    expect(checkPasswordPolicy("Namunacha")).toBe("noDigit");
    expect(checkPasswordPolicy("QWERT12345")).toBe("noLower");
    expect(checkPasswordPolicy("Намуна12")).toBeNull();
  });

  it("server 400 parol xabari maydon uchun olinadi, boshqa xato — yo'q", () => {
    expect(
      getPasswordPolicyServerMessage(
        axiosError(400, { statusCode: 400, message: ["Parol kamida 6 belgidan iborat bo'lishi kerak"] }),
      ),
    ).toBe("Parol kamida 6 belgidan iborat bo'lishi kerak");
    expect(
      getPasswordPolicyServerMessage(axiosError(400, { message: "Parol juda oddiy — boshqa parol tanlang" })),
    ).toBe("Parol juda oddiy — boshqa parol tanlang");
    expect(getPasswordPolicyServerMessage(axiosError(400, { message: "Telefon raqam noto'g'ri" }))).toBeUndefined();
    expect(getPasswordPolicyServerMessage(axiosError(409, { message: "Parol band" }))).toBeUndefined();
    expect(getPasswordPolicyServerMessage(new Error("x"))).toBeUndefined();
  });
});
