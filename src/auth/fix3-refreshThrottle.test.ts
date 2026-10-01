import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authClient, initAuth, refreshAccessToken, REFRESH_RETRY_DELAYS_MS } from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * fix3 RBAC-11 / C10 — /auth/refresh 429 (so'rov cheklovi) foydalanuvchini
 * tizimdan chiqarmaydi: refresh orqaga chekinib KO'PI BILAN 3 marta qayta
 * urinadi, so'ng ham 429 bo'lsa sessiya saqlanadi.
 */

const httpError = (status: number) =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    data: { message: status === 429 ? "ThrottlerException: Too Many Requests" : "Unauthorized" },
  } as AxiosResponse);

const jwtFor = (id: string, role: string) =>
  `h.${window.btoa(JSON.stringify({ sub: id, role })).replace(/=+$/, "")}.s`;

describe("refreshAccessToken — 429 da orqaga chekinib qayta urinish", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    tokenStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("429 dan keyin muvaffaqiyat — yangi token saqlanadi", async () => {
    const token = jwtFor("56", "courier");
    const post = vi
      .spyOn(authClient, "post")
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce({ data: { accessToken: token } });

    const pending = refreshAccessToken();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(pending).resolves.toBe(token);
    expect(post).toHaveBeenCalledTimes(2);
    expect(tokenStorage.getAccessToken()).toBe(token);
  });

  it("doim 429 — 1 + 3 urinish, keyin xato qaytadi (cheksiz emas)", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValue(httpError(429));

    const pending = refreshAccessToken();
    const settled = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20_000);

    const error = await settled;
    expect((error as AxiosError).response?.status).toBe(429);
    expect(post).toHaveBeenCalledTimes(1 + REFRESH_RETRY_DELAYS_MS.length);
  });

  it("401 da qayta urinilmaydi (sessiya haqiqatan yaroqsiz)", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValue(httpError(401));

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(AxiosError);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("initAuth — refresh 429 bo'lsa sessiya saqlanadi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    tokenStorage.setAccessToken("token-123");
    tokenStorage.setAuthIdentity({ id: "56", role: "courier" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("profil 401 → refresh doim 429: token o'chirilmaydi, /login ga tashlanmaydi", async () => {
    const clear = vi.spyOn(tokenStorage, "clear");
    vi.spyOn(authClient, "get").mockRejectedValue(httpError(401));
    vi.spyOn(authClient, "post").mockRejectedValue(httpError(429));

    const done = initAuth();
    await vi.advanceTimersByTimeAsync(20_000);
    await done;

    expect(clear).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBe("token-123");
  });
});
