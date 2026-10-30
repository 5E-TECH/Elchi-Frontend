import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPasswordChangeFlag,
  dismissPasswordChangePrompt,
  isPasswordChangeForced,
  isPasswordChangePromptOpen,
  requirePasswordChange,
  responseErrorCode,
  syncPasswordChangeFlag,
  usePasswordChangePrompt,
} from "./passwordChange";

/** Imzosiz soxta JWT (faqat payload o'qiladi). */
const fakeJwt = (payload: Record<string, unknown>) =>
  `x.${window.btoa(JSON.stringify(payload)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.y`;

describe("passwordChange (NDmZMzCP «Yangi parol o'rnating» bayrog'i)", () => {
  beforeEach(() => {
    clearPasswordChangeFlag();
    window.sessionStorage.clear();
  });

  it("login/refresh javobidagi `must_change_password` — faqat boolean bo'lsa o'zgaradi", () => {
    syncPasswordChangeFlag({ accessToken: "t" });
    expect(isPasswordChangePromptOpen()).toBe(false);
    syncPasswordChangeFlag({ accessToken: "t", must_change_password: true });
    expect(isPasswordChangePromptOpen()).toBe(true);
    syncPasswordChangeFlag({ accessToken: "t" }); // eski backend — o'zgarmaydi
    expect(isPasswordChangePromptOpen()).toBe(true);
    syncPasswordChangeFlag({ accessToken: "t", must_change_password: false });
    expect(isPasswordChangePromptOpen()).toBe(false);
  });

  it("«Keyinroq» — shu tabda qayta chiqmaydi (refresh yana `true` desa ham); 403 PASSWORD_CHANGE_REQUIRED qayta ochadi", () => {
    const { result } = renderHook(() => usePasswordChangePrompt());
    act(() => syncPasswordChangeFlag({ must_change_password: true }));
    expect(result.current).toBe(true);
    act(() => dismissPasswordChangePrompt());
    expect(result.current).toBe(false);
    expect(window.sessionStorage.getItem("elchi_pwd_change_dismissed")).toBe("1");
    act(() => syncPasswordChangeFlag({ must_change_password: true }));
    expect(result.current).toBe(false);
    act(() => requirePasswordChange());
    expect(result.current).toBe(true);
    act(() => clearPasswordChangeFlag());
    expect(result.current).toBe(false);
    expect(window.sessionStorage.getItem("elchi_pwd_change_dismissed")).toBeNull();
  });

  it("javob kodini `{ code }` va `{ data: { code } }` dan o'qiydi", () => {
    expect(responseErrorCode({ code: "LOGIN_LOCKED" })).toBe("LOGIN_LOCKED");
    expect(responseErrorCode({ data: { code: "PASSWORD_CHANGE_REQUIRED" } })).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(responseErrorCode({ message: "x" })).toBeUndefined();
    expect(responseErrorCode(null)).toBeUndefined();
  });
  describe("aidsxJ2H — majburiy rejim", () => {
    it("token `pwd_forced` — majburiy, «Keyinroq» ishlamaydi; bayroq tushsa — oddiy holat", () => {
      syncPasswordChangeFlag({
        must_change_password: true,
        accessToken: fakeJwt({ id: "7", role: "courier", pwd_change: true, pwd_forced: true }),
      });
      expect(isPasswordChangePromptOpen()).toBe(true);
      expect(isPasswordChangeForced()).toBe(true);
      dismissPasswordChangePrompt();
      expect(isPasswordChangePromptOpen()).toBe(true);
      expect(window.sessionStorage.getItem("elchi_pwd_change_dismissed")).toBeNull();

      syncPasswordChangeFlag({ must_change_password: false, accessToken: fakeJwt({ id: "7", role: "courier" }) });
      expect(isPasswordChangePromptOpen()).toBe(false);
      expect(isPasswordChangeForced()).toBe(false);
    });

    it("`pwd_forced` siz (zaif eski parol) — majburiy emas; 403 PASSWORD_CHANGE_REQUIRED — majburiy qiladi va refresh uni tushirmaydi", () => {
      syncPasswordChangeFlag({ must_change_password: true, accessToken: fakeJwt({ id: "7", pwd_change: true }) });
      expect(isPasswordChangeForced()).toBe(false);
      dismissPasswordChangePrompt();
      expect(isPasswordChangePromptOpen()).toBe(false);

      requirePasswordChange();
      expect(isPasswordChangePromptOpen()).toBe(true);
      expect(isPasswordChangeForced()).toBe(true);
      // Darvoza env bilan yoqilgan (token'da `pwd_forced` yo'q) — refresh bayroqni saqlasa, majburiy qoladi.
      syncPasswordChangeFlag({ must_change_password: true, accessToken: fakeJwt({ id: "7", pwd_change: true }) });
      expect(isPasswordChangeForced()).toBe(true);

      clearPasswordChangeFlag();
      expect(isPasswordChangeForced()).toBe(false);
      expect(isPasswordChangePromptOpen()).toBe(false);
    });

    it("buzilgan token — majburiy emas (xato yo'q)", () => {
      syncPasswordChangeFlag({ must_change_password: true, accessToken: "not-a-jwt" });
      expect(isPasswordChangePromptOpen()).toBe(true);
      expect(isPasswordChangeForced()).toBe(false);
    });
  });
});
