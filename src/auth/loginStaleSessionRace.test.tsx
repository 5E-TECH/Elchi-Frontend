import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import store from "../app/config/store";
import { createAppQueryClient } from "../app/lib/provider";
import { ThemeProvider } from "../app/providers/theme/ThemeContext";
import { NotificationProvider } from "../app/providers/notification/NotificationProvider";
import { UiHost } from "../app/providers/UiHost";
import SettingsSync from "../app/providers/SettingsSync";
import AuthBootstrap from "./AuthBootstrap";
import AuthGuard from "../features/auth/page";
import LoginPage from "../features/auth";
import { api } from "../shared/api/api";
import { toastStore } from "../shared/lib/notify";
import { authClient, resetRevokedLogoutForTests } from "./authService";
import { loginSuccess, setAppInitializing } from "../entities/user/model/slice";
import tokenStorage from "./tokenStorage";

/**
 * Sekin internet (2026-11-07): eski tab tiklandi, sessiya serverda oldinroq yopilgan; internet uzilib-qaytdi; eski
 * sessiyaning chiqishi (POST auth/logout) osilib qolgan paytda foydalanuvchi TO'G'RI parol bilan kirdi. Ilgari login
 * o'z profil so'rovini yubormay eski tokenning osilgan `['user','profile']` so'roviga qo'shilib, uning 401 ini olardi:
 * «Internet aloqasi yo'q» ostida «Parol noto'g'ri yoki foydalanuvchi topilmadi», keyin «Sessiya tugadi».
 * Hammasi ilovadagi haqiqiy simlar bilan: <AuthBootstrap> initAuth, <SettingsSync>/useSettings, brauzer
 * `offline`/`online` hodisalari, `authClient` va `api` uchun bitta soxta tarmoq.
 */

const b64url = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (p: Record<string, unknown>) => `${b64url({ alg: "HS256" })}.${b64url(p)}.sig`;
const OLD = jwt({ id: "77", role: "manager", sid: "11111111-1111-1111-1111-111111111111" });
const NEW = jwt({ id: "77", role: "manager", sid: "11111111-1111-1111-1111-111111111111", fresh: 1 });

type Entry = { method: string; url: string; auth: string };
const log: Entry[] = [];
let mode: "dead" | "live" = "dead";
let releaseLogout: (() => void) | null = null;
let newCookie = false; // login 201 sets a fresh refresh cookie; refresh then succeeds
const NEW2 = jwt({ id: "77", role: "manager", sid: "11111111-1111-1111-1111-111111111111", fresh: 2 });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown) => {
  const response = { data, status, statusText: String(status), headers: {}, config } as AxiosResponse;
  if (status >= 400) throw new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", config, {}, response);
  return response;
};
const tokenName = (auth: string) =>
  auth === `Bearer ${NEW}` ? "NEW" : auth === `Bearer ${NEW2}` ? "NEW2" : auth === `Bearer ${OLD}` ? "OLD" : auth ? "?" : "-";
const adapter = async (config: InternalAxiosRequestConfig) => {
  const url = String(config.url);
  const auth = String((config.headers as Record<string, unknown> | undefined)?.Authorization ?? "");
  log.push({ method: String(config.method).toUpperCase(), url, auth: tokenName(auth) });
  await delay(25); // RTT
  if (mode === "dead") throw new AxiosError("Network Error", "ERR_NETWORK", config, {});
  // Session was closed server-side before refreshTokenExpiresAt (revoked elsewhere / password reset / other tab logout).
  if (url.endsWith("auth/refresh"))
    return newCookie
      ? respond(config, 200, { accessToken: NEW2, accessTokenExpiresAt: Date.now() + 900_000, refreshTokenExpiresAt: Date.now() + 86_400_000 })
      : respond(config, 401, { message: "Refresh token yaroqsiz" });
  if (url.endsWith("auth/logout")) {
    await new Promise<void>((r) => (releaseLogout = r)); // slow link: logout POST outlives the user's typing
    return respond(config, 401, { message: "Unauthorized" });
  }
  if (url.endsWith("auth/login")) {
    newCookie = true;
    return respond(config, 201, { accessToken: NEW, accessTokenExpiresAt: Date.now() + 900_000, refreshTokenExpiresAt: Date.now() + 86_400_000 });
  }
  if (url.endsWith("auth/my-profile"))
    return auth === `Bearer ${NEW}`
      ? respond(config, 200, { data: { id: "77", role: "manager", name: "M", settings: {} } })
      : respond(config, 401, { message: "Unauthorized" });
  return respond(config, 200, { data: [] });
};

const replace = vi.fn();

beforeEach(() => {
  window.sessionStorage.clear();
  tokenStorage.clear();
  resetRevokedLogoutForTests();
  toastStore.reset();
  onlineManager.setOnline(true);
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, pathname: "/", replace } as Location);
  authClient.defaults.adapter = adapter as never;
  api.defaults.adapter = adapter as never;
});
afterEach(() => vi.restoreAllMocks());

describe("sekin internet: eski sessiya chiqishi paytida to'g'ri parol bilan kirish", () => {
  it("«Parol noto'g'ri» chiqmaydi, foydalanuvchi tizimda qoladi", async () => {
    // Restored tab: access expired, refresh not expired by the clock, but closed server-side.
    tokenStorage.setAccessToken(OLD);
    tokenStorage.setSessionMetadata({ accessTokenExpiresAt: Date.now() - 60_000, refreshTokenExpiresAt: Date.now() + 3_600_000 });
    tokenStorage.setAuthIdentity({ id: "77", role: "manager" });
    // Same as the slice's initialState on a page load with a stored token (store module was created before this test).
    store.dispatch(loginSuccess({ accessToken: OLD }));
    store.dispatch(setAppInitializing(true));

    const qc = createAppQueryClient();
    render(
      <I18nextProvider i18n={i18n} defaultNS="common">
        <ThemeProvider>
          <Provider store={store}>
            <MemoryRouter initialEntries={["/"]}>
              <QueryClientProvider client={qc}>
                <NotificationProvider>
                  <UiHost />
                  <AuthBootstrap>
                    <SettingsSync />
                    <Routes>
                      <Route path="/" element={<AuthGuard />}>
                        <Route index element={<div>dashboard</div>} />
                      </Route>
                      <Route path="/login" element={<LoginPage />} />
                    </Routes>
                  </AuthBootstrap>
                </NotificationProvider>
              </QueryClientProvider>
            </MemoryRouter>
          </Provider>
        </ThemeProvider>
      </I18nextProvider>,
    );

    // 1) Boot on a dead link: initAuth refresh -> ERR_NETWORK -> keepSessionWhileOffline -> toast + dashboard (OLD kept).
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Internet aloqasi yo'q")).toBeInTheDocument());
    act(() => void window.dispatchEvent(new Event("offline")));
    // Phone stays without signal for a while (longer than the profile query's 1 s network retry delay).
    await act(async () => {
      await delay(1500);
    });

    // 2) Link returns: real `online` event.
    mode = "live";
    act(() => void window.dispatchEvent(new Event("online")));
    await delay(300);
    await waitFor(() => expect(log.some((l) => l.url.endsWith("auth/logout"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("dashboard")).toBeNull());

    // 3) On /login: «Sessiya tugadi» -> «Qayta kirish» (if shown) -> correct credentials.
    const user = userEvent.setup();
    const again = await screen.findByRole("button", { name: "Qayta kirish" }).catch(() => null);
    if (again) await user.click(again);
    await user.type(screen.getByLabelText("Telefon raqam"), "90 123 45 67");
    await user.type(screen.getByLabelText("Parol"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Kirish" }));
    await waitFor(() => expect(log.some((l) => l.url.endsWith("auth/login"))).toBe(true));
    await delay(150);

    // 4) Old logout POST finally returns.
    await act(async () => {
      releaseLogout?.();
      await delay(200);
    });
    await delay(200);

    const text = document.body.textContent ?? "";
    const outcome = {
      wrongPasswordShown: text.includes("Parol noto'g'ri yoki foydalanuvchi topilmadi"),
      hintShown: text.includes("Telefon raqam va parolni tekshirib"),
      offlineToastShown: text.includes("Internet aloqasi yo'q"),
      timeoutToastShown: text.includes("Server javob bermadi"),
      restoredToastShown: text.includes("Aloqa tiklandi"),
      systemErrorShown: text.includes("Tizim xatoligi"),
      dashboardShown: text.includes("dashboard"),
      tokenAtEnd: tokenName(tokenStorage.getAccessToken() ? `Bearer ${tokenStorage.getAccessToken()}` : ""),
      isAuthenticated: store.getState().user.isAuthenticated,
      locationReplace: replace.mock.calls.map((c) => c[0]),
      profileGetWithNEW: log.some((l) => l.url.endsWith("auth/my-profile") && l.auth === "NEW"),
      logoutWithNewSession: log.some((l) => l.url.endsWith("auth/logout") && l.auth.startsWith("NEW")),
      queryErrorToast: text.includes("Ma'lumotni yuklab bo'lmadi"),
      settingsCache: JSON.stringify(qc.getQueryState(["user", "profile"])?.data ?? null).slice(0, 80),
    };

    expect(outcome.wrongPasswordShown).toBe(false);
    expect(outcome.hintShown).toBe(false);
    expect(outcome.profileGetWithNEW).toBe(true);
    expect(outcome.isAuthenticated).toBe(true);
    expect(outcome.tokenAtEnd.startsWith("NEW")).toBe(true);
    expect(outcome.logoutWithNewSession).toBe(false);
    expect(outcome.locationReplace).toEqual([]);
    expect(outcome.dashboardShown).toBe(true);
    // Eski tokenning yangilash xatosi yangi token bilan qayta yangilanib, profil keshiga yozilmadi.
    expect(outcome.settingsCache).not.toContain("accessToken");
  });
});
