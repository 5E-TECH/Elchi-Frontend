import { describe, expect, it } from "vitest";
import { getOldPasswordErrorKind } from "./oldPassword";

const err = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

describe("getOldPasswordErrorKind (aidsxJ2H)", () => {
  it("400 OLD_PASSWORD_REQUIRED / OLD_PASSWORD_INVALID — `{ code }` va `{ data: { code } }`", () => {
    expect(getOldPasswordErrorKind(err(400, { code: "OLD_PASSWORD_REQUIRED" }))).toBe("required");
    expect(getOldPasswordErrorKind(err(400, { code: "OLD_PASSWORD_INVALID" }))).toBe("invalid");
    expect(getOldPasswordErrorKind(err(400, { data: { code: "OLD_PASSWORD_INVALID" } }))).toBe("invalid");
  });

  it("boshqa status yoki kod — null (401 bu yo'l emas)", () => {
    expect(getOldPasswordErrorKind(err(401, { code: "OLD_PASSWORD_INVALID" }))).toBeNull();
    expect(getOldPasswordErrorKind(err(400, { message: "Yangi parol joriy paroldan farq qilishi kerak" }))).toBeNull();
    expect(getOldPasswordErrorKind(new Error("x"))).toBeNull();
    expect(getOldPasswordErrorKind(null)).toBeNull();
  });
});
