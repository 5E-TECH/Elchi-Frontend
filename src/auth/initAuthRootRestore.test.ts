import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { setAppInitializing } from "../entities/user/model/slice";
import { authClient, initAuth } from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * Qidiruvdan «/» ga kelgan yangi tashrifchi (2026-11-06): `index.html` sessiya belgisi (`elchi_had_session`) yo'q
 * bo'lsa manzilni `/login` ga almashtiradi va `elchi_root_restore` qo'yadi. `initAuth` shunda cookie sessiyasini FONDA
 * tiklaydi: yuklanish ekranisiz (forma ko'rinadi); tiklansa — yuklanish holati «kirgan» holatdan OLDIN yoqiladi
 * (kirish sahifasi tarjimalar kelmasdan «/» ga o'tib ketmaydi). Belgi kirish / tiklashda yoziladi, sessiya
 * topilmasa o'chiriladi.
 */
const locales = vi.hoisted(() => {
  let resolve: () => void = () => {};
  return {
    load: vi.fn(() => new Promise<void>((done) => (resolve = done))),
    finish: () => resolve(),
  };
});

vi.mock("../i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../i18n")>()),
  loadAppLocales: locales.load,
}));

const fromRoot = () => {
  window.sessionStorage.setItem("elchi_root_restore", "1");
  window.history.pushState({}, "", "/login");
};

const unauthorized = () =>
  Object.assign(new Error("401"), { isAxiosError: true, response: { status: 401, data: {} } });

describe("initAuth — «/» dan kelgan tashrifchi, fon tiklash", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    tokenStorage.clear();
    locales.load.mockClear();
    // Ilovada `index.html` manzilni chizishdan oldin `/login` qiladi — tokensiz `/login` da boshlang'ich holat «tayyor»
    // (`entities/user/model/slice.ts`, forma darhol ko'rinadi). Test store'i «/» da yaratilgan — shu holatga keltiriladi.
    store.dispatch(setAppInitializing(false));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    tokenStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("cookie yo'q (401) — yuklanish ekrani umuman yoqilmaydi, forma qoladi, tarjimalar so'ralmaydi", async () => {
    fromRoot();
    const post = vi.spyOn(authClient, "post").mockRejectedValue(unauthorized());
    const loading: boolean[] = [];
    const unsubscribe = store.subscribe(() =>
      loading.push(store.getState().user.isAppInitializing),
    );

    await initAuth();
    unsubscribe();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe("auth/refresh");
    expect(loading).not.toContain(true);
    expect(store.getState().user.isAuthenticated).toBe(false);
    expect(locales.load).not.toHaveBeenCalled();
    // Belgi bir martalik; sessiya belgisi yo'q.
    expect(window.sessionStorage.getItem("elchi_root_restore")).toBeNull();
    expect(window.localStorage.getItem("elchi_had_session")).toBeNull();
  });

  it("cookie sessiyasi bor — tiklanadi: yuklanish «kirgan» holatdan oldin, tarjimalar kutiladi, belgi yoziladi", async () => {
    fromRoot();
    vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: "token-root" } });
    vi.spyOn(authClient, "get").mockResolvedValue({
      data: { data: { id: "56", role: "courier", name: "Kuryer" } },
    });
    let loadingWhenSignedIn: boolean | null = null;
    const unsubscribe = store.subscribe(() => {
      const { isAuthenticated, isAppInitializing } = store.getState().user;
      if (isAuthenticated && loadingWhenSignedIn === null) loadingWhenSignedIn = isAppInitializing;
    });

    const done = initAuth();
    await vi.waitFor(() => expect(locales.load).toHaveBeenCalledTimes(1));
    expect(loadingWhenSignedIn).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().user.isAppInitializing).toBe(true);

    locales.finish();
    await done;
    unsubscribe();
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.isAppInitializing).toBe(false);
    expect(window.localStorage.getItem("elchi_had_session")).toBe("1");
  });

  it("`/login` ni ataylab ochgan (belgisiz) — avvalgidek: tiklash so'rovi yo'q", async () => {
    window.history.pushState({}, "", "/login");
    const post = vi.spyOn(authClient, "post");

    await initAuth();

    expect(post).not.toHaveBeenCalled();
    expect(store.getState().user.isAuthenticated).toBe(false);
  });
});
