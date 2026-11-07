import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { setAppInitializing } from "../entities/user/model/slice";
import {
  abandonSessionRestore,
  authClient,
  initAuth,
  resetSessionRestoreForTests,
  RESTORE_RETRY_DELAYS_MS,
  retrySessionRestoreNow,
} from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * Sessiyani tiklash (sekin internet, 2026-11-07): ilova tarjimalari (uzRest chunk) sekin kelsa ham qayta urinish
 * zanjiri uzilmaydi. `initAuth` ning `finally` qismi tarjimalarni kutadi — shu paytda 2 s taymeri otilsa `initAuth()`
 * eski va'dani qaytarardi va ekran abadiy «kutish» da qolardi.
 */
const LOCALES_MS = 5_000;

const locales = vi.hoisted(() => ({ load: vi.fn<() => Promise<void>>() }));

vi.mock("../i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../i18n")>()),
  loadAppLocales: locales.load,
}));

const refreshCalls = (post: { mock: { calls: unknown[][] } }) =>
  post.mock.calls.filter(([url]) => String(url).includes("refresh")).length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  window.sessionStorage.clear();
  window.localStorage.clear();
  tokenStorage.clear();
  window.history.pushState({}, "", "/");
  store.dispatch(setAppInitializing(true));
  locales.load.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, LOCALES_MS)));
});

afterEach(() => {
  resetSessionRestoreForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
  tokenStorage.clear();
  store.dispatch(setAppInitializing(false));
});

describe("initAuth — tiklash va sekin tarjimalar", () => {
  it("2 s taymeri tarjimalar kelmasdan otilsa — keyingi urinish oldingisi tugagach baribir ketadi", async () => {
    const post = vi
      .spyOn(authClient, "post")
      .mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"))
      .mockResolvedValueOnce({
        data: { accessToken: "a.eyJpZCI6Ijc3Iiwicm9sZSI6Im1hbmFnZXIifQ.s" },
      });
    vi.spyOn(authClient, "get").mockResolvedValue({
      data: { data: { id: "77", role: "manager" } },
    });

    const first = initAuth();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCalls(post)).toBe(1);
    expect(store.getState().user.sessionRestore).toEqual({ phase: "waiting", reason: "network" });

    // Taymer (2 s) — tarjimalar (5 s) hali kelmagan, birinchi ishga tushish tugamagan.
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0]);
    expect(refreshCalls(post)).toBe(1);

    await vi.advanceTimersByTimeAsync(LOCALES_MS);
    await first;
    await vi.advanceTimersByTimeAsync(LOCALES_MS);

    expect(refreshCalls(post)).toBe(2);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.sessionRestore).toBeNull();
    expect(store.getState().user.isAppInitializing).toBe(false);
  });

  it.each([
    ["2 s taymeri", () => vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0])],
    ["«Qayta urinish» tugmasi", async () => retrySessionRestoreNow()],
  ])(
    "%s navbatga qo'ygan urinish «Kirish sahifasiga o'tish» dan keyin ketmaydi — til, mavzu, sessiya belgisi saqlanadi",
    async (_label, wake) => {
      window.localStorage.setItem("elchi_had_session", "1");
      window.localStorage.setItem("app-language", "ru");
      window.localStorage.setItem("theme", "dark");
      const post = vi
        .spyOn(authClient, "post")
        .mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const first = initAuth();
      await vi.advanceTimersByTimeAsync(0);
      expect(refreshCalls(post)).toBe(1);
      expect(store.getState().user.sessionRestore).toEqual({ phase: "waiting", reason: "network" });

      // Urinish navbatda: birinchi ishga tushish tarjimalarni (5 s) kutmoqda. Shu orada foydalanuvchi formaga o'tadi.
      await wake();
      abandonSessionRestore();
      window.history.pushState({}, "", "/login");

      await vi.advanceTimersByTimeAsync(LOCALES_MS);
      await first;
      await vi.advanceTimersByTimeAsync(30_000);

      expect(refreshCalls(post)).toBe(1);
      expect(window.localStorage.getItem("elchi_had_session")).toBe("1");
      expect(window.localStorage.getItem("app-language")).toBe("ru");
      expect(window.localStorage.getItem("theme")).toBe("dark");
      expect(store.getState().user.sessionRestore).toBeNull();
      expect(store.getState().user.isAppInitializing).toBe(false);
    },
  );
});
