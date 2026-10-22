import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authClient, login, refreshAccessToken } from "./authService";
import { DEVICE_ID_STORAGE_KEY, deviceIdHeaders, getDeviceId } from "./deviceId";
import tokenStorage from "./tokenStorage";

/**
 * `X-Device-Id` (Elchi Pochta #3): shu brauzer uchun bitta tasodifiy ID, `localStorage` da; faqat
 * `POST auth/login` va `POST auth/refresh` bilan; saqlab bo'lmasa — yuborilmaydi.
 */
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("getDeviceId", () => {
  it("bir marta yaratiladi va keyin o'sha qiymat qaytadi", () => {
    const first = getDeviceId();
    expect(first).toMatch(/^[0-9a-f-]{32,36}$/i);
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(first);
    expect(getDeviceId()).toBe(first);
    expect(deviceIdHeaders()).toEqual({ "X-Device-Id": first });
  });

  it("buzilgan saqlangan qiymat — yangisi bilan almashtiriladi", () => {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, "<script>");
    const id = getDeviceId();
    expect(id).not.toBe("<script>");
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id);
  });

  it("saqlab bo'lmasa (maxfiy rejim) — `null`, sarlavha yo'q", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(getDeviceId()).toBeNull();
    expect(deviceIdHeaders()).toEqual({});
  });
});

describe("login va refresh sarlavhasi", () => {
  it("POST auth/login — `X-Device-Id` bilan", async () => {
    const post = vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: "token-login" } });
    vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: { id: "56", role: "courier", name: "Kuryer" } } });

    await login({ phone_number: "+998901234567", password: "secret" });

    const id = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    expect(id).toBeTruthy();
    expect(post).toHaveBeenCalledWith(
      "auth/login",
      { phone_number: "+998901234567", password: "secret" },
      { headers: { "X-Device-Id": id } },
    );
  });

  it("POST auth/refresh — o'sha ID bilan", async () => {
    const id = getDeviceId();
    tokenStorage.setAccessToken("token-old");
    vi.spyOn(tokenStorage, "tokenMatchesCurrentSession").mockReturnValue(true);
    const post = vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: "token-new" } });

    await expect(refreshAccessToken()).resolves.toBe("token-new");
    expect(post).toHaveBeenCalledWith("auth/refresh", {}, { headers: { "X-Device-Id": id } });
  });
});
