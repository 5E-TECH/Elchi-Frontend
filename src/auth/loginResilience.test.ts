import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { authClient, initAuth, login, LOGIN_RETRY_DELAY_MS, LOGIN_RETRY_JITTER_MS, PROFILE_BACKGROUND_DELAYS_MS } from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * «Tarmoq xatoligi» (h0AM0kDL): qisqa uzilishda login yiqilmasin, har tashrifda qayta kirish talab qilinmasin.
 */
const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");
const timeoutError = () => new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED");
const httpError = (status: number) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, { status, data: {} } as AxiosResponse);

const b64url = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`;
const TOKEN = jwt({ id: "77", role: "manager", sid: "s-1" });
const PROFILE = { id: "77", role: "manager", name: "Menejer", settings: { appearance: { theme: "dark" } } };
const credentials = { phone_number: "+998901234567", password: "secret" };
const loginOk = { data: { accessToken: TOKEN } };
const profileOk = { data: { data: PROFILE } };

const goTo = (path: string) => window.history.pushState({}, "", path);

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  tokenStorage.clear();
  goTo("/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  goTo("/");
});

describe("login() — POST auth/login qayta urinishi", () => {
  it("darhol uzilish (ERR_NETWORK) — bir marta, 400–800 ms dan keyin qayta yuboriladi va kirish o'tadi", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const post = vi.spyOn(authClient, "post").mockRejectedValueOnce(networkError()).mockResolvedValueOnce(loginOk);
    vi.spyOn(authClient, "get").mockResolvedValue(profileOk);

    const done = login(credentials);
    await vi.advanceTimersByTimeAsync(LOGIN_RETRY_DELAY_MS + LOGIN_RETRY_JITTER_MS / 2 - 1);
    expect(post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await done;

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][0]).toBe(post.mock.calls[0][0]);
    expect(result.user).toMatchObject({ id: "77" });
    expect(tokenStorage.getAccessToken()).toBe(TOKEN);
  });

  it("ikkinchi urinish ham uzilsa — xato (faqat BITTA qayta urinish)", async () => {
    const post = vi.spyOn(authClient, "post").mockRejectedValue(networkError());
    const done = login(credentials).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(LOGIN_RETRY_DELAY_MS + LOGIN_RETRY_JITTER_MS);
    expect(await done).toMatchObject({ code: "ERR_NETWORK" });
    expect(post).toHaveBeenCalledTimes(2);
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it.each([
    ["vaqt tugashi (ECONNABORTED)", timeoutError()],
    ["401 — parol noto'g'ri", httpError(401)],
    ["429", httpError(429)],
    ["500", httpError(500)],
  ])("%s — qayta urinilmaydi", async (_name, error) => {
    const post = vi.spyOn(authClient, "post").mockRejectedValue(error);
    const done = login(credentials).catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await done).toBe(error);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("login() — profil javobsiz qolsa kirish bekor qilinmaydi", () => {
  it("profil 1 s / 3 s dan keyin qayta so'raladi va keladi", async () => {
    vi.spyOn(authClient, "post").mockResolvedValue(loginOk);
    const get = vi.spyOn(authClient, "get").mockRejectedValueOnce(networkError()).mockResolvedValueOnce(profileOk);
    const done = login(credentials);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await done;
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.user).toMatchObject({ id: "77", name: "Menejer" });
  });

  it("profil umuman kelmasa — token saqlanadi, rol/id JWT'dan, profil fonda yuklanadi", async () => {
    vi.spyOn(authClient, "post").mockResolvedValue(loginOk);
    const get = vi
      .spyOn(authClient, "get")
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(profileOk);

    const done = login(credentials);
    await vi.advanceTimersByTimeAsync(4_000);
    const result = await done;

    expect(result).toEqual({ accessToken: TOKEN, user: null });
    expect(tokenStorage.getAccessToken()).toBe(TOKEN);
    expect(tokenStorage.getAuthIdentity()).toEqual({ id: "77", role: "manager" });
    expect(store.getState().role.role).toBe("manager");
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(get).toHaveBeenCalledTimes(3);

    // Fonda: birinchi urinish 5 s dan keyin — profil keladi.
    await vi.advanceTimersByTimeAsync(PROFILE_BACKGROUND_DELAYS_MS[0]);
    expect(get).toHaveBeenCalledTimes(4);
    expect(store.getState().user.user).toMatchObject({ id: "77", name: "Menejer" });
  });

  it("profil 401 (server rad etdi) — kirish bekor qilinadi", async () => {
    vi.spyOn(authClient, "post").mockResolvedValue(loginOk);
    vi.spyOn(authClient, "get").mockRejectedValue(httpError(401));
    const done = login(credentials).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await done).toMatchObject({ response: { status: 401 } });
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("token'da rol yo'q — eski oqim: kirish bekor qilinadi", async () => {
    vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: "opaque-token" } });
    vi.spyOn(authClient, "get").mockRejectedValue(networkError());
    const done = login(credentials).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await done).toMatchObject({ code: "ERR_NETWORK" });
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});

describe("initAuth() — token yo'q ochilishda refresh cookie bilan tiklash", () => {
  it("yangi tab (/) — POST auth/refresh, keyin profil: qayta kirish talab qilinmaydi", async () => {
    const post = vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: TOKEN } });
    const get = vi.spyOn(authClient, "get").mockResolvedValue(profileOk);

    await initAuth();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/refresh/);
    expect(get).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe(TOKEN);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.isAppInitializing).toBe(false);
  });

  it("cookie yo'q / yaroqsiz (401) — jim, kirish sahifasi", async () => {
    vi.spyOn(authClient, "post").mockRejectedValue(httpError(401));
    const get = vi.spyOn(authClient, "get");
    const onNetworkError = vi.fn();
    window.addEventListener("elchi:network-error", onNetworkError);

    await initAuth();

    expect(get).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(store.getState().user.isAuthenticated).toBe(false);
    expect(store.getState().user.isAppInitializing).toBe(false);
    expect(onNetworkError).not.toHaveBeenCalled();
    window.removeEventListener("elchi:network-error", onNetworkError);
  });

  it("tarmoq yo'q — kirish sahifasi (ilova osilib qolmaydi)", async () => {
    vi.spyOn(authClient, "post").mockRejectedValue(networkError());
    await initAuth();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(store.getState().user.isAppInitializing).toBe(false);
  });

  it("profil kelmasa — rol token'dan (tab identifikatori hali yo'q)", async () => {
    vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: TOKEN } });
    vi.spyOn(authClient, "get").mockRejectedValue(networkError());
    const done = initAuth();
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(tokenStorage.getAccessToken()).toBe(TOKEN);
    expect(store.getState().role.role).toBe("manager");
  });

  it.each(["/login", "/login/", "/tg/scan"])("%s — tiklanmaydi (ataylab kirish / Telegram o'z kirishi)", async (path) => {
    goTo(path);
    const post = vi.spyOn(authClient, "post");
    await initAuth();
    expect(post).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("chiqishdan keyingi 10 s — tiklanmaydi", async () => {
    window.sessionStorage.setItem("elchi_skip_refresh_once", String(Date.now()));
    const post = vi.spyOn(authClient, "post");
    await initAuth();
    expect(post).not.toHaveBeenCalled();
  });
});
