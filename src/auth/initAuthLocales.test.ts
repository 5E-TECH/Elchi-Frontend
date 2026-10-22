import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { authClient, initAuth } from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * rzzxMItN — sessiya bilan ochilganda ilova o'zbekcha tarjimalarning qolgan qismi kelgandan keyingina «tayyor»
 * (`isAppInitializing: false`): to'g'ridan-to'g'ri `/login` da ham (u `/` ga o'tkazadi), modul darajasidagi
 * `i18n.t("ns:…")` kalit qaytarmasin.
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

describe("initAuth — tarjimalar chizishdan oldin", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    tokenStorage.setAccessToken("token-123");
    tokenStorage.setAuthIdentity({ id: "56", role: "courier" });
    locales.load.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    tokenStorage.clear();
  });

  it("profil kelgach ham tarjimalar kelguncha ilova yuklanish holatida", async () => {
    vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: { id: "56", role: "courier", name: "Kuryer" } } });

    const done = initAuth();
    await vi.waitFor(() => expect(locales.load).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().user.isAppInitializing).toBe(true);

    locales.finish();
    await done;
    expect(store.getState().user.isAppInitializing).toBe(false);
  });

  it("tokensiz (login sahifasi) — tarjimalar kutilmaydi", async () => {
    tokenStorage.clear();
    await initAuth();
    expect(locales.load).not.toHaveBeenCalled();
    expect(store.getState().user.isAppInitializing).toBe(false);
  });
});
