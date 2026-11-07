import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { setAppInitializing } from "../entities/user/model/slice";
import {
  abandonSessionRestore,
  AUTH_REINIT_DELAY_MS,
  authClient,
  initAuth,
  login,
  logout,
  REFRESH_RETRY_DELAYS_MS,
  resetSessionRestoreForTests,
  RESTORE_REFRESH_TIMEOUT_MS,
  RESTORE_RETRY_DELAYS_MS,
  RESTORE_SLOW_HINT_MS,
  retrySessionRestoreNow,
} from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * SESSIYANI TIKLASH — SEKIN INTERNET (2026-11-07). Yangi tab / PWA ochilishida (token yo'q) cookie bilan tiklash
 * tarmoq / vaqt / 429 / 5xx da yiqilsa — foydalanuvchi jim kirish sahifasiga TASHLANMAYDI, sozlamalari o'chirilmaydi:
 * «Internet sekin — qayta urinilmoqda» ekrani va qayta urinish (2 s, 5 s, 10 s, …; `online` — darhol).
 */
const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");
const timeoutError = () => new AxiosError("timeout of 45000ms exceeded", "ECONNABORTED");
const httpError = (status: number) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, { status, data: {} } as AxiosResponse);

const b64url = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`;
const TOKEN = jwt({ id: "77", role: "manager", sid: "s-1" });
const LOGIN_TOKEN = jwt({ id: "88", role: "courier", sid: "s-2" });
const PROFILE = { id: "77", role: "manager", name: "Menejer" };
const refreshOk = { data: { accessToken: TOKEN } };
const profileOk = { data: { data: PROFILE } };

const user = () => store.getState().user;
const goTo = (path: string) => window.history.pushState({}, "", path);
const refreshCalls = (post: { mock: { calls: unknown[][] } }) =>
  post.mock.calls.filter(([url]) => String(url).includes("refresh")).length;

/**
 * Kelmayotgan javob (EDGE da qotgan so'rov). Test oxirida 401 bilan yopiladi — `initAuth` bitta umumiy va'da
 * (`initPromise`), osilib qolsa keyingi testlar o'sha va'dani olardi.
 */
let hung: Array<(error: unknown) => void> = [];
const pending = () => new Promise<never>((_, reject) => hung.push(reject));
/** Testlarda boshlangan `initAuth` ishga tushishlari — `afterEach` tugashini kutadi. */
let runs: Promise<void>[] = [];
const start = () => {
  const run = initAuth();
  runs.push(run);
  return run;
};

let onNetworkError: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  window.sessionStorage.clear();
  window.localStorage.clear();
  tokenStorage.clear();
  window.localStorage.setItem("elchi_had_session", "1");
  window.localStorage.setItem("app-language", "ru");
  window.localStorage.setItem("theme", "dark");
  goTo("/");
  store.dispatch(setAppInitializing(true));
  onNetworkError = vi.fn<() => void>();
  window.addEventListener("elchi:network-error", onNetworkError);
});

afterEach(async () => {
  window.removeEventListener("elchi:network-error", onNetworkError);
  resetSessionRestoreForTests();
  for (const reject of hung) reject(httpError(401));
  hung = [];
  await Promise.allSettled(runs);
  runs = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  tokenStorage.clear();
  store.dispatch(setAppInitializing(false));
  goTo("/");
});

describe("initAuth — sessiyani tiklash vaqtincha yiqildi", () => {
  it("ERR_NETWORK — ekran «waiting», yuklanish holati qoladi, belgi / til / mavzu O'CHIRILMAYDI, tarmoq xabari yo'q", async () => {
    vi.spyOn(authClient, "post").mockRejectedValue(networkError());

    await start();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(user().isAppInitializing).toBe(true);
    expect(user().sessionRestore).toEqual({ phase: "waiting", reason: "network" });
    expect(window.localStorage.getItem("elchi_had_session")).toBe("1");
    expect(window.localStorage.getItem("app-language")).toBe("ru");
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(onNetworkError).not.toHaveBeenCalled();
  });

  it("qayta urinishlar 2 s, 5 s, 10 s, 10 s dan keyin (har biri BITTA POST); urinish paytida «retrying»; so'ng kiradi", async () => {
    const post = vi
      .spyOn(authClient, "post")
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError());
    vi.spyOn(authClient, "get").mockResolvedValue(profileOk);

    await start();
    expect(refreshCalls(post)).toBe(1);

    const expected = [...RESTORE_RETRY_DELAYS_MS, RESTORE_RETRY_DELAYS_MS[RESTORE_RETRY_DELAYS_MS.length - 1]];
    for (const [index, delay] of expected.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(refreshCalls(post)).toBe(index + 1);
      if (index === expected.length - 1) {
        // Oxirgi urinish muvaffaqiyatli — javob kelguncha «retrying».
        let resolveRefresh: (value: typeof refreshOk) => void = () => {};
        post.mockImplementationOnce(() => new Promise((resolve) => (resolveRefresh = resolve)));
        await vi.advanceTimersByTimeAsync(1);
        expect(refreshCalls(post)).toBe(index + 2);
        expect(user().sessionRestore).toEqual({ phase: "retrying", reason: "network" });
        resolveRefresh(refreshOk);
        await vi.advanceTimersByTimeAsync(0);
      } else {
        await vi.advanceTimersByTimeAsync(1);
        expect(refreshCalls(post)).toBe(index + 2);
      }
    }

    expect(tokenStorage.getAccessToken()).toBe(TOKEN);
    expect(user().isAuthenticated).toBe(true);
    expect(user().sessionRestore).toBeNull();
    expect(user().isAppInitializing).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refreshCalls(post)).toBe(5);
  });

  it("vaqt tugashi (ECONNABORTED) — xuddi tarmoq xatosi kabi; so'rov 45 s kutadi", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValue(timeoutError());

    await start();

    expect(post.mock.calls[0][2]).toMatchObject({ timeout: RESTORE_REFRESH_TIMEOUT_MS });
    expect(user().sessionRestore).toEqual({ phase: "waiting", reason: "network" });
    expect(user().isAppInitializing).toBe(true);
    expect(window.localStorage.getItem("elchi_had_session")).toBe("1");
  });

  it("1-urinish 15 s dan oshsa — «slow» ekrani, so'rov bekor qilinmaydi (bitta POST)", async () => {
    const post = vi.spyOn(authClient, "post").mockImplementation(pending);

    void start();
    await vi.advanceTimersByTimeAsync(RESTORE_SLOW_HINT_MS - 1);
    expect(user().sessionRestore).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(user().sessionRestore).toEqual({ phase: "slow", reason: "network" });
    expect(user().isAppInitializing).toBe(true);
    expect(refreshCalls(post)).toBe(1);
  });

  it("15 s ichida kelsa — ekran umuman chiqmaydi", async () => {
    let resolveRefresh: (value: typeof refreshOk) => void = () => {};
    vi.spyOn(authClient, "post").mockImplementation(() => new Promise((resolve) => (resolveRefresh = resolve)));
    vi.spyOn(authClient, "get").mockResolvedValue(profileOk);
    const states: unknown[] = [];
    const unsubscribe = store.subscribe(() => states.push(user().sessionRestore));

    const done = start();
    await vi.advanceTimersByTimeAsync(RESTORE_SLOW_HINT_MS - 1_000);
    resolveRefresh(refreshOk);
    await done;
    await vi.advanceTimersByTimeAsync(RESTORE_SLOW_HINT_MS);
    unsubscribe();

    expect(states.every((state) => state == null)).toBe(true);
    expect(user().isAuthenticated).toBe(true);
    expect(user().isAppInitializing).toBe(false);
  });

  it("kutish paytida `online` — darhol qayta urinish; urinish paytidagi `online` qo'shimcha POST bermaydi", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValueOnce(networkError()).mockImplementation(pending);

    await start();
    expect(refreshCalls(post)).toBe(1);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCalls(post)).toBe(2);
    expect(user().sessionRestore).toEqual({ phase: "retrying", reason: "network" });

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0] * 2);
    expect(refreshCalls(post)).toBe(2);
  });

  it("«Qayta urinish» — kutish paytida darhol, urinish ketayotganda hech narsa", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValueOnce(networkError()).mockImplementation(pending);

    await start();
    retrySessionRestoreNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCalls(post)).toBe(2);
    retrySessionRestoreNow();
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0] * 2);
    expect(refreshCalls(post)).toBe(2);
  });

  it("qayta urinishda 401 — jim kirish sahifasi, sessiya belgisi o'chadi, boshqa POST yo'q", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValueOnce(networkError()).mockRejectedValue(httpError(401));

    await start();
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0]);

    expect(refreshCalls(post)).toBe(2);
    expect(user().sessionRestore).toBeNull();
    expect(user().isAppInitializing).toBe(false);
    expect(window.localStorage.getItem("elchi_had_session")).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refreshCalls(post)).toBe(2);
  });

  it("429 — 1-urinishda ichki 1/3/7 s takror (4 POST), sabab «server»; keyingisi 30 s dan keyin va BITTA POST", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValue(httpError(429));

    const done = start();
    await vi.advanceTimersByTimeAsync(REFRESH_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0));
    await done;
    expect(refreshCalls(post)).toBe(1 + REFRESH_RETRY_DELAYS_MS.length);
    expect(user().sessionRestore).toEqual({ phase: "waiting", reason: "server" });

    await vi.advanceTimersByTimeAsync(AUTH_REINIT_DELAY_MS - 1);
    expect(refreshCalls(post)).toBe(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshCalls(post)).toBe(5);
    await vi.advanceTimersByTimeAsync(REFRESH_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0));
    expect(refreshCalls(post)).toBe(5);
    expect(user().sessionRestore).toEqual({ phase: "waiting", reason: "server" });
  });
});

describe("initAuth — «Kirish sahifasiga o'tish», kirish, chiqish", () => {
  it("kutish paytida «Kirish sahifasiga o'tish» — ekran yopiladi, forma ochiladi, boshqa POST yo'q", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValue(networkError());

    await start();
    abandonSessionRestore();

    expect(user().sessionRestore).toBeNull();
    expect(user().isAppInitializing).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCalls(post)).toBe(1);
    expect(window.localStorage.getItem("app-language")).toBe("ru");
  });

  it("sekin urinishda «Kirish sahifasiga o'tish», keyin javob keldi — yuklanish ekrani qaytadi va sessiya tiklanadi", async () => {
    let resolveRefresh: (value: typeof refreshOk) => void = () => {};
    vi.spyOn(authClient, "post").mockImplementation(() => new Promise((resolve) => (resolveRefresh = resolve)));
    vi.spyOn(authClient, "get").mockResolvedValue(profileOk);

    const done = start();
    await vi.advanceTimersByTimeAsync(RESTORE_SLOW_HINT_MS);
    expect(user().sessionRestore).toEqual({ phase: "slow", reason: "network" });
    abandonSessionRestore();
    expect(user().isAppInitializing).toBe(false);

    const loadingBeforeAuth: boolean[] = [];
    const unsubscribe = store.subscribe(() => {
      if (!loadingBeforeAuth.length && user().isAuthenticated) loadingBeforeAuth.push(user().isAppInitializing);
    });
    resolveRefresh(refreshOk);
    await done;
    unsubscribe();

    expect(loadingBeforeAuth).toEqual([true]);
    expect(tokenStorage.getAccessToken()).toBe(TOKEN);
    expect(user().isAppInitializing).toBe(false);
    expect(user().sessionRestore).toBeNull();
  });

  it("sekin urinishda «Kirish sahifasiga o'tish», keyin tarmoq xatosi — hech narsa rejalanmaydi, sozlamalar qoladi", async () => {
    let rejectRefresh: (error: unknown) => void = () => {};
    const post = vi
      .spyOn(authClient, "post")
      .mockImplementation(() => new Promise((_, reject) => (rejectRefresh = reject)));

    const done = start();
    await vi.advanceTimersByTimeAsync(RESTORE_SLOW_HINT_MS);
    abandonSessionRestore();
    rejectRefresh(networkError());
    await done;

    expect(user().sessionRestore).toBeNull();
    expect(user().isAppInitializing).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refreshCalls(post)).toBe(1);
    expect(window.localStorage.getItem("app-language")).toBe("ru");
    expect(window.localStorage.getItem("elchi_had_session")).toBe("1");
  });

  it("tiklash javobi kutilayotganda kirish boshlandi — kech kelgan tiklash tashlanadi, kirish tokeni qoladi", async () => {
    let resolveRefresh: (value: typeof refreshOk) => void = () => {};
    const post = vi.spyOn(authClient, "post").mockImplementation((url: string) =>
      url.includes("refresh")
        ? new Promise((resolve) => (resolveRefresh = resolve))
        : Promise.resolve({ data: { accessToken: LOGIN_TOKEN } }),
    );
    vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: { id: "88", role: "courier" } } });

    const restore = start();
    await vi.advanceTimersByTimeAsync(RESTORE_SLOW_HINT_MS);
    abandonSessionRestore();
    await login({ phone_number: "+998901112233", password: "secret" });
    resolveRefresh(refreshOk);
    await restore;

    expect(tokenStorage.getAccessToken()).toBe(LOGIN_TOKEN);
    expect(user().sessionRestore).toBeNull();
    // Tiklash taymeri qolmagan: keyin ham `auth/refresh` yuborilmaydi, ekran chiqmaydi.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refreshCalls(post)).toBe(1);
    expect(user().sessionRestore).toBeNull();
    expect(tokenStorage.getAccessToken()).toBe(LOGIN_TOKEN);
  });

  it("kirish POST i hali ketayotganda tiklash javobi keldi — tiklash tokeni hech qachon saqlanmaydi (abandonIf)", async () => {
    let resolveRefresh: (value: typeof refreshOk) => void = () => {};
    let resolveLogin: (value: { data: { accessToken: string } }) => void = () => {};
    vi.spyOn(authClient, "post").mockImplementation((url: string) =>
      url.includes("refresh")
        ? new Promise((resolve) => (resolveRefresh = resolve))
        : new Promise((resolve) => (resolveLogin = resolve)),
    );
    const get = vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: { id: "88", role: "courier" } } });
    const stored = vi.spyOn(tokenStorage, "setAccessToken");
    const seen: Array<string | null> = [];
    const unsubscribe = store.subscribe(() => seen.push(user().accessToken));

    const restore = start();
    await vi.advanceTimersByTimeAsync(RESTORE_SLOW_HINT_MS);
    abandonSessionRestore();
    const signingIn = login({ phone_number: "+998901112233", password: "secret" });
    await vi.advanceTimersByTimeAsync(0);
    // Kirish POST i javobsiz — epoch hali o'zgarmagan; tiklash javobini faqat `abandonIf` tashlaydi.
    resolveRefresh(refreshOk);
    await vi.advanceTimersByTimeAsync(0);
    resolveLogin({ data: { accessToken: LOGIN_TOKEN } });
    await signingIn;
    await restore;
    unsubscribe();

    expect(stored.mock.calls.map(([token]) => token)).not.toContain(TOKEN);
    expect(seen).not.toContain(TOKEN);
    expect(tokenStorage.getAccessToken()).toBe(LOGIN_TOKEN);
    expect(get).toHaveBeenCalledTimes(1);
    expect(user().sessionRestore).toBeNull();
  });

  it("kutish paytida chiqish — taymerlar to'xtaydi, boshqa POST auth/refresh yo'q", async () => {
    const post = vi.spyOn(authClient, "post").mockImplementation((url: string) =>
      url.includes("refresh") ? Promise.reject(networkError()) : Promise.resolve({ data: {} }),
    );

    await start();
    expect(user().sessionRestore).not.toBeNull();
    await logout();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(refreshCalls(post)).toBe(1);
    expect(user().sessionRestore).toBeNull();
  });
});

describe("initAuth — ekran chiqmaydigan holatlar", () => {
  it("«/» dan kelgan fon tiklash (/login + elchi_root_restore) — tarmoq xatosida jim: ekran ham, taymer ham yo'q", async () => {
    goTo("/login");
    window.sessionStorage.setItem("elchi_root_restore", "1");
    store.dispatch(setAppInitializing(false));
    const post = vi.spyOn(authClient, "post").mockRejectedValue(networkError());

    await start();

    expect(user().sessionRestore).toBeNull();
    expect(user().isAppInitializing).toBe(false);
    expect(window.localStorage.getItem("app-language")).toBe("ru");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refreshCalls(post)).toBe(1);
  });

  it.each(["/login", "/tg/scan"])("%s — tiklanmaydi, ekran yo'q", async (path) => {
    goTo(path);
    const post = vi.spyOn(authClient, "post");
    await start();
    expect(post).not.toHaveBeenCalled();
    expect(user().sessionRestore).toBeNull();
  });

  it("chiqishdan keyingi 10 s — tiklanmaydi, ekran yo'q", async () => {
    window.sessionStorage.setItem("elchi_skip_refresh_once", String(Date.now()));
    const post = vi.spyOn(authClient, "post");
    await start();
    expect(post).not.toHaveBeenCalled();
    expect(user().sessionRestore).toBeNull();
  });
});
