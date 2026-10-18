import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { authClient, initAuth, logoutAndRedirect } from "./authService";
import { peekLoginNoticeDetails, rememberLoginNotice } from "./loginNotice";
import tokenStorage from "./tokenStorage";

const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");
const httpError = (status: number) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, { status, data: {} } as AxiosResponse);

describe("initAuth on a flaky network (9w5Fq94s)", () => {
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

  const runInit = async () => {
    const done = initAuth();
    // 1 s va 3 s lik qayta urinishlarni o'tkazib yuborish.
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
  };

  it("keeps the session (no tokenStorage.clear) when /auth/my-profile fails with ERR_NETWORK", async () => {
    const clear = vi.spyOn(tokenStorage, "clear");
    const get = vi.spyOn(authClient, "get").mockRejectedValue(networkError());
    const onNetworkError = vi.fn();
    window.addEventListener("elchi:network-error", onNetworkError);

    await runInit();

    expect(clear).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBe("token-123");
    // Oxirgi ma'lum rol bilan ilova ochiladi — /login ga tashlanmaydi.
    expect(store.getState().role.role).toBe("courier");
    // 1 + 2 qayta urinish.
    expect(get).toHaveBeenCalledTimes(3);
    // Foydalanuvchiga "Tarmoq xatosi" bildirishnomasi.
    expect(onNetworkError).toHaveBeenCalled();
    window.removeEventListener("elchi:network-error", onNetworkError);
  });

  it("recovers on a retry when the network comes back within the retry window", async () => {
    vi.spyOn(authClient, "get")
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ data: { data: { id: "56", role: "courier", name: "Kuryer" } } });

    await runInit();

    expect(tokenStorage.getAccessToken()).toBe("token-123");
    expect(store.getState().role.role).toBe("courier");
  });

  it("keeps the session on a 5xx (server problem, not the user's fault)", async () => {
    const clear = vi.spyOn(tokenStorage, "clear");
    vi.spyOn(authClient, "get").mockRejectedValue(httpError(503));

    await runInit();

    expect(clear).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBe("token-123");
  });

  it("still logs out when the server rejects the session (401 and the refresh also fails)", async () => {
    vi.spyOn(authClient, "get").mockRejectedValue(httpError(401));
    vi.spyOn(authClient, "post").mockRejectedValue(httpError(401));

    await runInit();

    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});

describe("logoutAndRedirect — «Sessiya tugadi» xabari (dizayn v2 common-session-expired)", () => {
  const NOW = new Date("2026-10-17T14:20:00").getTime();
  let replace: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    window.sessionStorage.clear();
    tokenStorage.setAccessToken("token-123");
    replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace } as Location);
    vi.spyOn(authClient, "post").mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("reason sessionExpired → remembers the refresh-token expiry time (read before logout clears it) and redirects", async () => {
    const expiredAt = NOW - 5 * 60_000;
    tokenStorage.setSessionMetadata({ refreshTokenExpiresAt: expiredAt, refreshTokenWarnAt: expiredAt - 900_000 });

    await logoutAndRedirect({ reason: "sessionExpired" });

    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: expiredAt });
    expect(tokenStorage.getSessionMetadata().refreshTokenExpiresAt).toBeNull();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("the server rejected the session before the token expiry → the time is now, not a future time", async () => {
    tokenStorage.setSessionMetadata({ refreshTokenExpiresAt: NOW + 3_600_000 });

    await logoutAndRedirect({ reason: "sessionExpired" });

    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: NOW });
  });

  it("no expiry metadata → now", async () => {
    await logoutAndRedirect({ reason: "sessionExpired" });

    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: NOW });
  });

  it("concurrent calls: a later call (metadata already cleared) keeps the earlier real expiry time", async () => {
    const expiredAt = NOW - 8 * 3_600_000;
    tokenStorage.setSessionMetadata({ refreshTokenExpiresAt: expiredAt });

    await logoutAndRedirect({ reason: "sessionExpired" });
    // `logout()` metama'lumotni tozaladi — keyingi chaqiruv «hozir» ni hisoblaydi, lekin yozmaydi.
    await logoutAndRedirect({ reason: "sessionExpired" });

    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: expiredAt });
  });

  it("a passwordChanged notice wins over sessionExpired", async () => {
    rememberLoginNotice("passwordChanged");

    await logoutAndRedirect({ reason: "sessionExpired" });

    expect(peekLoginNoticeDetails()).toEqual({ notice: "passwordChanged", at: null });
  });

  it("manual «Chiqish» (no reason) writes no notice and drops a stale sessionExpired one; passwordChanged stays", async () => {
    await logoutAndRedirect();
    expect(peekLoginNoticeDetails()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");

    rememberLoginNotice("sessionExpired", { at: NOW - 1_000 });
    await logoutAndRedirect();
    expect(peekLoginNoticeDetails()).toBeNull();

    rememberLoginNotice("passwordChanged");
    await logoutAndRedirect();
    expect(peekLoginNoticeDetails()).toEqual({ notice: "passwordChanged", at: null });
  });
});
