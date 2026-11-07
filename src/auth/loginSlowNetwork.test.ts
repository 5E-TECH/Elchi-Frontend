import { QueryClient } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { loginSuccess, setAppInitializing } from "../entities/user/model/slice";
import { api } from "../shared/api/api";
import { queryKeys } from "../shared/config/queryKeys";
import {
  authClient,
  bindProfileCache,
  initAuth,
  isLoginProfileStageError,
  login,
  LOGIN_TIMEOUT_MS,
  logoutAndRedirect,
  resetRevokedLogoutForTests,
} from "./authService";
import { peekLoginNotice } from "./loginNotice";
import { getNetworkDownKind, markNetworkDown, NETWORK_RESTORED_EVENT } from "./networkError";
import tokenStorage from "./tokenStorage";

/**
 * Sekin internetda login (2026-11-07, Dilshod: «to'g'ri login parol kirityabman, internet ishlamiyabdi deb
 * ogohlantirish chiqib … login parolni ham noto'g'ri deyabdi»):
 *   - server parolni qabul qilgan bo'lsa, keyingi profil 401 «Parol noto'g'ri» deb ko'rsatilmaydi;
 *   - eski sessiyaning kechikkan chiqishi yangi kirishni o'chirmaydi;
 *   - /login dagi «Internet aloqasi yo'q» xabari server javobi kelgach yopiladi;
 *   - login POST sekin birinchi ulanishga (DNS + TLS + preflight ~15 s) yetadigan vaqt kutadi.
 */
const b64url = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`;
const OLD = jwt({ id: "77", role: "manager", sid: "s-1" });
const NEW = jwt({ id: "77", role: "manager", sid: "s-1", n: 2 });
const NEW2 = jwt({ id: "77", role: "manager", sid: "s-2", n: 3 });
const PROFILE = { id: "77", role: "manager", name: "Menejer", settings: {} };
const credentials = { phone_number: "+998901234567", password: "secret" };

const response = (config: InternalAxiosRequestConfig, status: number, data: unknown) => {
  const res = { data, status, statusText: String(status), headers: {}, config } as AxiosResponse;
  if (status >= 400) throw new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", config, {}, res);
  return res;
};
const http401 = () =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 401,
    data: { message: "Session revoked" },
  } as AxiosResponse);

const replace = vi.fn();
const originalAuthAdapter = authClient.defaults.adapter;
const originalApiAdapter = api.defaults.adapter;

beforeEach(() => {
  window.sessionStorage.clear();
  tokenStorage.clear();
  resetRevokedLogoutForTests();
  replace.mockReset();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, pathname: "/", replace } as Location);
});

afterEach(() => {
  vi.restoreAllMocks();
  authClient.defaults.adapter = originalAuthAdapter;
  api.defaults.adapter = originalApiAdapter;
});

describe("login() — server parolni qabul qilgach profil 401", () => {
  it("bir marta qayta kiriladi (server yangi sessiya ochadi) va kirish o'tadi", async () => {
    const post = vi
      .spyOn(authClient, "post")
      .mockResolvedValueOnce({ data: { accessToken: NEW } })
      .mockResolvedValueOnce({ data: { accessToken: NEW2 } });
    const get = vi
      .spyOn(authClient, "get")
      .mockRejectedValueOnce(http401())
      .mockResolvedValueOnce({ data: { data: PROFILE } });

    const result = await login(credentials);

    expect(post).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1]).toMatchObject({ headers: { Authorization: `Bearer ${NEW2}` } });
    expect(result).toMatchObject({ accessToken: NEW2, user: { id: "77" } });
    expect(tokenStorage.getAccessToken()).toBe(NEW2);
  });

  it("qayta kirishda ham 401 — profil bosqichi xatosi (parol xatosi emas), token tozalanadi", async () => {
    const post = vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: NEW } });
    vi.spyOn(authClient, "get").mockRejectedValue(http401());

    const error = await login(credentials).catch((caught: unknown) => caught);

    expect(post).toHaveBeenCalledTimes(2); // faqat BITTA qayta kirish
    expect(error).toMatchObject({ response: { status: 401 } });
    expect(isLoginProfileStageError(error)).toBe(true);
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("login javobining o'zi 401 (parol haqiqatan noto'g'ri) — profil bosqichi emas, qayta yuborilmaydi", async () => {
    const wrong = http401();
    const post = vi.spyOn(authClient, "post").mockRejectedValue(wrong);

    const error = await login(credentials).catch((caught: unknown) => caught);

    expect(error).toBe(wrong);
    expect(isLoginProfileStageError(error)).toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("login() — oldingi sessiya keshi", () => {
  it("kirishda oldingi sessiya so'rovlari keshi tashlanadi (sahifa qayta yuklanmasa ham), profil — yangisi", async () => {
    const client = new QueryClient();
    bindProfileCache(client);
    try {
      client.setQueryData(["orders", "list"], { data: ["oldingi xodimning buyurtmasi"] });
      vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: NEW } });
      vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: PROFILE } });

      await login(credentials);

      expect(client.getQueryData(["orders", "list"])).toBeUndefined();
      expect(client.getQueryData(queryKeys.myProfile)).toMatchObject({ data: { id: "77" } });
    } finally {
      bindProfileCache(null);
    }
  });
});

describe("login() — sekin birinchi ulanish", () => {
  it(`POST auth/login ${LOGIN_TIMEOUT_MS / 1000} s kutadi (umumiy 15 s emas)`, async () => {
    expect(LOGIN_TIMEOUT_MS).toBe(45_000);
    const post = vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: NEW } });
    vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: PROFILE } });

    await login(credentials);

    expect(post.mock.calls[0][2]).toMatchObject({ timeout: LOGIN_TIMEOUT_MS });
    expect(authClient.defaults.timeout).toBe(15_000); // bootstrap / refresh / profil — o'zgarmagan
  });
});

describe("authClient — server javobi «Internet aloqasi yo'q» holatini yopadi", () => {
  it("javob (401 ham) — `elchi:network-restored`; javobsiz uzilish — yo'q", async () => {
    const restored = vi.fn();
    window.addEventListener(NETWORK_RESTORED_EVENT, restored);
    try {
      authClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError("Network Error", "ERR_NETWORK", config, {});
      }) as never;
      markNetworkDown("offline");
      await authClient.post("auth/login", {}).catch(() => undefined);
      expect(restored).not.toHaveBeenCalled();
      expect(getNetworkDownKind()).toBe("offline");

      authClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) =>
        response(config, 401, { message: "Telefon raqami yoki parol noto'g'ri" })) as never;
      await authClient.post("auth/login", {}).catch(() => undefined);
      expect(restored).toHaveBeenCalledTimes(1);
      expect(getNetworkDownKind()).toBeNull();
    } finally {
      window.removeEventListener(NETWORK_RESTORED_EVENT, restored);
    }
  });
});

describe("eski sessiyaning kechikkan chiqishi", () => {
  it("chiqish tugaguncha qayta kirildi — yangi sessiya qoladi, /login ga qaytarilmaydi, «Sessiya tugadi» o'chadi", async () => {
    let releaseLogout: (() => void) | null = null;
    const adapter = async (config: InternalAxiosRequestConfig) => {
      const url = String(config.url);
      if (url.endsWith("auth/logout")) {
        await new Promise<void>((resolve) => (releaseLogout = resolve)); // sekin tarmoq: chiqish so'rovi osilib qoldi
        return response(config, 401, { message: "Unauthorized" });
      }
      if (url.endsWith("auth/login")) return response(config, 201, { accessToken: NEW });
      if (url.endsWith("auth/my-profile")) return response(config, 200, { data: PROFILE });
      throw new AxiosError(`unexpected ${url}`);
    };
    authClient.defaults.adapter = adapter as never;
    tokenStorage.setAccessToken(OLD);
    store.dispatch(loginSuccess({ accessToken: OLD }));

    const loggingOut = logoutAndRedirect({ reason: "sessionExpired" });
    await vi.waitFor(() => expect(releaseLogout).not.toBeNull());
    expect(peekLoginNotice()).toBe("sessionExpired");

    await login(credentials); // foydalanuvchi to'g'ri parol bilan kirdi
    releaseLogout!();
    await loggingOut;

    expect(tokenStorage.getAccessToken()).toBe(NEW);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(replace).not.toHaveBeenCalled();
    expect(peekLoginNotice()).toBeNull();
  });

  it("«Chiqish» token yangilanishi paytida bosilsa — baribir chiqadi", async () => {
    let releaseRefresh: (() => void) | null = null;
    const adapter = async (config: InternalAxiosRequestConfig) => {
      const url = String(config.url);
      if (url.endsWith("auth/refresh")) {
        await new Promise<void>((resolve) => (releaseRefresh = resolve));
        return response(config, 200, {
          accessToken: NEW,
          accessTokenExpiresAt: Date.now() + 900_000,
          refreshTokenExpiresAt: Date.now() + 86_400_000,
        });
      }
      if (url.endsWith("auth/logout")) {
        await new Promise((resolve) => setTimeout(resolve, 30)); // yangilash javobi chiqish javobidan oldin keladi
        return response(config, 200, {});
      }
      if (url.endsWith("orders")) return response(config, 200, { data: [] });
      throw new AxiosError(`unexpected ${url}`);
    };
    authClient.defaults.adapter = adapter as never;
    api.defaults.adapter = adapter as never;
    tokenStorage.setAccessToken(OLD);
    tokenStorage.setSessionMetadata({ accessTokenExpiresAt: Date.now() - 1_000, refreshTokenExpiresAt: Date.now() + 3_600_000 });
    store.dispatch(loginSuccess({ accessToken: OLD }));

    const pending = api.get("orders").catch(() => undefined); // so'rov interceptor'i token yangilashni boshladi
    await vi.waitFor(() => expect(releaseRefresh).not.toBeNull());
    const loggingOut = logoutAndRedirect();
    releaseRefresh!(); // yangilash javobi chiqishdan oldin keldi
    await loggingOut;
    await pending;

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(store.getState().user.isAuthenticated).toBe(false);
    expect(replace).toHaveBeenCalledWith("/login");
  });
});

describe("eski sessiya ishi qayta kirishdan keyin tugaydi (tekshiruvdan keyin)", () => {
  it("eski chiqish login so'rovi hali javob kutayotganda tugasa — sahifa qayta yuklanmaydi, yuklash ekrani qoladi", async () => {
    let releaseLogin: (() => void) | null = null;
    let releaseLogout: (() => void) | null = null;
    authClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const url = String(config.url);
      if (url.endsWith("auth/logout")) {
        await new Promise<void>((resolve) => (releaseLogout = resolve));
        return response(config, 401, { message: "Unauthorized" });
      }
      if (url.endsWith("auth/login")) {
        await new Promise<void>((resolve) => (releaseLogin = resolve)); // sekin: login javobi kechikdi
        return response(config, 201, { accessToken: NEW });
      }
      if (url.endsWith("auth/my-profile")) return response(config, 200, { data: PROFILE });
      throw new AxiosError(`unexpected ${url}`);
    }) as never;
    tokenStorage.setAccessToken(OLD);
    store.dispatch(loginSuccess({ accessToken: OLD }));

    const loggingOut = logoutAndRedirect({ reason: "sessionExpired" });
    await vi.waitFor(() => expect(releaseLogout).not.toBeNull());
    store.dispatch(setAppInitializing(true)); // LoginForm.onSubmit
    const loggingIn = login(credentials);
    await vi.waitFor(() => expect(releaseLogin).not.toBeNull());

    releaseLogout!(); // eski chiqish BIRINCHI tugadi
    await loggingOut;
    expect(replace).not.toHaveBeenCalled();
    expect(store.getState().user.isAppInitializing).toBe(true);

    releaseLogin!();
    await loggingIn;
    expect(tokenStorage.getAccessToken()).toBe(NEW);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(peekLoginNotice()).toBeNull();
  });

  it("chiqish davomida qayta kirilgach 10 s ichida F5 — yangi sessiya o'chmaydi", async () => {
    let releaseLogout: (() => void) | null = null;
    authClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const url = String(config.url);
      if (url.endsWith("auth/logout")) {
        await new Promise<void>((resolve) => (releaseLogout = resolve));
        return response(config, 401, {});
      }
      if (url.endsWith("auth/login")) return response(config, 201, { accessToken: NEW });
      if (url.endsWith("auth/my-profile")) return response(config, 200, { data: PROFILE });
      throw new AxiosError(`unexpected ${url}`);
    }) as never;
    tokenStorage.setAccessToken(OLD);
    store.dispatch(loginSuccess({ accessToken: OLD }));

    const loggingOut = logoutAndRedirect({ reason: "sessionExpired" });
    await vi.waitFor(() => expect(releaseLogout).not.toBeNull());
    await login(credentials);
    await initAuth(); // sahifa qayta yuklandi (token sessionStorage'da)
    releaseLogout!();
    await loggingOut;

    expect(tokenStorage.getAccessToken()).toBe(NEW);
    expect(store.getState().user.isAuthenticated).toBe(true);
  });

  it("eski sessiya so'rovining 401 i kirishdan keyin keldi — yangi cookie bilan yangilanmaydi, qayta yuborilmaydi", async () => {
    const calls: string[] = [];
    let releaseOrder: (() => void) | null = null;
    const adapter = async (config: InternalAxiosRequestConfig) => {
      const url = String(config.url);
      const auth = String((config.headers as Record<string, unknown> | undefined)?.Authorization ?? "");
      calls.push(`${String(config.method).toUpperCase()} ${url} ${auth === `Bearer ${NEW}` ? "NEW" : auth === `Bearer ${OLD}` ? "OLD" : "-"}`);
      if (url.endsWith("cashbox/close")) {
        await new Promise<void>((resolve) => (releaseOrder = resolve)); // eski xodimning amali, sekin
        return response(config, 401, { message: "Unauthorized" });
      }
      if (url.endsWith("auth/login")) return response(config, 201, { accessToken: NEW });
      if (url.endsWith("auth/my-profile")) return response(config, 200, { data: PROFILE });
      if (url.endsWith("auth/refresh")) return response(config, 200, { accessToken: NEW2 });
      throw new AxiosError(`unexpected ${url}`);
    };
    authClient.defaults.adapter = adapter as never;
    api.defaults.adapter = adapter as never;
    tokenStorage.setAccessToken(OLD);
    store.dispatch(loginSuccess({ accessToken: OLD }));

    const oldAction = api.post("cashbox/close", { amount: 1 }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(releaseOrder).not.toBeNull());
    await login(credentials); // boshqa xodim kirdi
    releaseOrder!();
    const outcome = await oldAction;

    expect(outcome).toMatchObject({ response: { status: 401 } });
    expect(calls.filter((c) => c.includes("auth/refresh"))).toEqual([]);
    expect(calls.filter((c) => c.startsWith("POST cashbox/close"))).toEqual(["POST cashbox/close OLD"]);
    expect(tokenStorage.getAccessToken()).toBe(NEW);
    expect(replace).not.toHaveBeenCalled();
  });

  it("eski token yangilash javobi kirishdan keyin keldi — yangi tokenning ustiga yozilmaydi, chiqarilmaydi", async () => {
    let releaseRefresh: (() => void) | null = null;
    const adapter = async (config: InternalAxiosRequestConfig) => {
      const url = String(config.url);
      if (url.endsWith("auth/refresh")) {
        await new Promise<void>((resolve) => (releaseRefresh = resolve));
        return response(config, 200, {
          accessToken: NEW2,
          accessTokenExpiresAt: Date.now() + 900_000,
          refreshTokenExpiresAt: Date.now() + 86_400_000,
        });
      }
      if (url.endsWith("auth/login")) return response(config, 201, { accessToken: NEW });
      if (url.endsWith("auth/my-profile")) return response(config, 200, { data: PROFILE });
      if (url.endsWith("orders")) return response(config, 200, { data: [] });
      throw new AxiosError(`unexpected ${url}`);
    };
    authClient.defaults.adapter = adapter as never;
    api.defaults.adapter = adapter as never;
    tokenStorage.setAccessToken(OLD);
    tokenStorage.setSessionMetadata({ accessTokenExpiresAt: Date.now() - 1_000, refreshTokenExpiresAt: Date.now() + 3_600_000 });
    store.dispatch(loginSuccess({ accessToken: OLD }));

    const oldRequest = api.get("orders").catch((error: unknown) => error); // interceptor eski token'ni yangilayapti
    await vi.waitFor(() => expect(releaseRefresh).not.toBeNull());
    await login(credentials);
    releaseRefresh!();
    const outcome = await oldRequest;

    expect(outcome).toBeInstanceOf(Error);
    expect(tokenStorage.getAccessToken()).toBe(NEW);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("fon tiklash (cookie) javobi kirishdan keyin yiqildi — yangi sessiya tozalanmaydi", async () => {
    let releaseRefresh: (() => void) | null = null;
    authClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const url = String(config.url);
      if (url.endsWith("auth/refresh")) {
        await new Promise<void>((resolve) => (releaseRefresh = resolve));
        return response(config, 401, { message: "Refresh token topilmadi" });
      }
      if (url.endsWith("auth/login")) return response(config, 201, { accessToken: NEW });
      if (url.endsWith("auth/my-profile")) return response(config, 200, { data: PROFILE });
      throw new AxiosError(`unexpected ${url}`);
    }) as never;

    const booting = initAuth(); // token yo'q — cookie bilan tiklash, sekin
    await vi.waitFor(() => expect(releaseRefresh).not.toBeNull());
    await login(credentials);
    releaseRefresh!();
    await booting;

    expect(tokenStorage.getAccessToken()).toBe(NEW);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.isAppInitializing).toBe(false);
  });
});
