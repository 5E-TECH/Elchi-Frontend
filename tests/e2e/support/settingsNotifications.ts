import { expect, type Page, type Route } from "@playwright/test";

/** Sozlamalar → Bildirishnomalar (F89H1avs) e2e — soxta backend, sozlama serverda "saqlanadi". */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const mockSettingsApi = async (
  page: Page,
  { initialSettings = {}, theme = "dark" }: { initialSettings?: Record<string, unknown>; theme?: "dark" | "light" } = {},
) => {
  // Mavzu serverdagi `appearance.theme` dan sinxronlanadi (SettingsSync) — localStorage yetarli emas.
  // Dizayn v2: server mavzusi faqat foydalanuvchi uni O'ZI tanlagan bo'lsa (`themeChosen`) qo'llanadi.
  const state = {
    settings: { ...initialSettings, appearance: { theme, themeChosen: true, ...(initialSettings.appearance as object | undefined) } } as Record<string, unknown>,
  };
  const patches: Record<string, unknown>[] = [];
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "1", role: "superadmin", name: "Bosh admin", status: "active", settings: state.settings }));
    }
    if (path === "auth/my-settings" && request.method() === "PATCH") {
      const body = request.postDataJSON() as { settings: Record<string, unknown> };
      state.settings = body.settings;
      patches.push(body.settings);
      return reply(route, wrap({ settings: state.settings }));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript((theme) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", theme);
  }, theme);
  return { state, patches, leaked };
};

export const openNotificationsTab = async (page: Page) => {
  await page.goto("/settings");
  await page.getByRole("main").getByRole("button", { name: /Bildirishnomalar/ }).click({ timeout: 60_000 });
  await expect(page.getByTestId("notifications-scope-notice")).toBeVisible();
};
