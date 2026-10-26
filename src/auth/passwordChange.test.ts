import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPasswordChangeFlag,
  dismissPasswordChangePrompt,
  isPasswordChangePromptOpen,
  requirePasswordChange,
  responseErrorCode,
  syncPasswordChangeFlag,
  usePasswordChangePrompt,
} from "./passwordChange";

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
});
