import { describe, expect, it } from "vitest";
import { isGenericForbiddenError } from "./forbiddenError";

// Ilovadagi kabi axios xatosi (`isAxiosError`): kutubxona matni («Request failed …») backend xabari hisoblanmaydi.
const httpError = (status: number, message?: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: message === undefined ? {} : { message } },
  });

describe("isGenericForbiddenError", () => {
  it("403 + umumiy inglizcha matn yoki matnsiz — true", () => {
    expect(isGenericForbiddenError(httpError(403, "Forbidden resource"))).toBe(true);
    expect(isGenericForbiddenError(httpError(403, "forbidden"))).toBe(true);
    expect(isGenericForbiddenError(httpError(403))).toBe(true);
  });

  it("403 + backendning aniq sababi — false (o'sha matn ko'rsatiladi)", () => {
    expect(isGenericForbiddenError(httpError(403, "Bu market sizning filialingizga tegishli emas"))).toBe(false);
  });

  it("403 dan boshqa status — false", () => {
    expect(isGenericForbiddenError(httpError(400, "Forbidden resource"))).toBe(false);
    expect(isGenericForbiddenError(new Error("network"))).toBe(false);
  });
});
