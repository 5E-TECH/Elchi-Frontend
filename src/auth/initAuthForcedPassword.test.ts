import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authClient, initAuth } from "./authService";
import {
  clearPasswordChangeFlag,
  isPasswordChangeForced,
  isPasswordChangePromptOpen,
} from "./passwordChange";
import tokenStorage from "./tokenStorage";

const fakeJwt = (payload: Record<string, unknown>) =>
  `x.${window.btoa(JSON.stringify(payload)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.y`;

/**
 * aidsxJ2H: vaqtinchalik parol bilan kirgan foydalanuvchi sahifani yangilasa — modul holati yo'qoladi, token qoladi,
 * refresh chaqirilmaydi. Bloklovchi oyna birinchi 403 ni kutmasdan tiklanishi kerak.
 */
describe("initAuth — sahifa yangilanganda `pwd_forced`", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearPasswordChangeFlag();
    tokenStorage.setAuthIdentity({ id: "56", role: "courier" });
    vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: { id: "56", role: "courier", name: "Kuryer" } } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    tokenStorage.clear();
    clearPasswordChangeFlag();
  });

  it("token'da `pwd_forced` — oyna bloklovchi rejimda ochiq", async () => {
    tokenStorage.setAccessToken(fakeJwt({ id: "56", role: "courier", pwd_change: true, pwd_forced: true }));
    await initAuth();
    expect(isPasswordChangePromptOpen()).toBe(true);
    expect(isPasswordChangeForced()).toBe(true);
  });

  it("oddiy token — oyna ochilmaydi", async () => {
    tokenStorage.setAccessToken(fakeJwt({ id: "56", role: "courier" }));
    await initAuth();
    expect(isPasswordChangePromptOpen()).toBe(false);
  });
});
