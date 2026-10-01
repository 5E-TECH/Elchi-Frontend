import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { getActionErrorMessage } from "./actionError";

const FALLBACK = "Amalni bajarib bo'lmadi";

const httpError = (status: number, data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
  } as AxiosResponse);

/** fix3 FE-ORD-02 — rad javobining sababi foydalanuvchiga ko'rinadi. */
describe("getActionErrorMessage", () => {
  it("backend xabari ko'rsatiladi", () => {
    expect(
      getActionErrorMessage(
        httpError(400, { message: "Uyga yetkaziladigan buyurtmalarda qo'shimcha xarajat yozish mumkin emas" }),
        FALLBACK,
      ),
    ).toBe("Uyga yetkaziladigan buyurtmalarda qo'shimcha xarajat yozish mumkin emas");
    expect(getActionErrorMessage(httpError(400, { message: ["a", "b"] }), FALLBACK)).toBe("a, b");
  });

  it("xabarsiz javob — fallback (axios'ning inglizcha matni emas)", () => {
    expect(getActionErrorMessage(httpError(500, {}), FALLBACK)).toBe(FALLBACK);
  });

  it("javob kelmagan (tarmoq) — null: global 'Tarmoq xatosi' allaqachon chiqqan", () => {
    expect(getActionErrorMessage(new AxiosError("Network Error", "ERR_NETWORK"), FALLBACK)).toBeNull();
    expect(getActionErrorMessage(new AxiosError("timeout", "ECONNABORTED"), FALLBACK)).toBeNull();
  });

  it("bekor qilingan so'rov va axios bo'lmagan xato — fallback", () => {
    expect(getActionErrorMessage(new AxiosError("canceled", "ERR_CANCELED"), FALLBACK)).toBe(FALLBACK);
    expect(getActionErrorMessage(new Error("Proof file upload did not return a key"), FALLBACK)).toBe(FALLBACK);
  });
});
