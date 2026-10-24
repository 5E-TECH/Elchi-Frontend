import { expect, type Page, type Route } from "@playwright/test";

/**
 * Balans → Tahlil (`/financial-balance?tab=analysis`) e2e uchun soxta backend va kirish: superadmin, til va mavzu
 * profil sozlamasidan (`settings.appearance`) — ilova `localStorage` ni kirgach shu bilan almashtiradi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

export type BalanceSession = { language?: "uz" | "ru" | "en"; theme?: "light" | "dark" };

export const openBalanceAnalysis = async (page: Page, { language = "uz", theme = "light" }: BalanceSession = {}) => {
  const leaked: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: {
          id: "1",
          role: "superadmin",
          name: "E2E",
          status: "active",
          settings: { appearance: { theme, themeChosen: true, language } },
        },
      });
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(
    ({ language, theme }) => {
      const far = Date.now() + 86_400_000;
      window.sessionStorage.setItem("accessToken", "e2e.local.token");
      window.sessionStorage.setItem(
        "authSessionMetadata",
        JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
      );
      window.localStorage.setItem("app-language", language);
      window.localStorage.setItem("theme", theme);
      window.localStorage.setItem("theme-version", "2");
    },
    { language, theme },
  );
  await page.goto("/financial-balance?tab=analysis");
  const period = page.getByRole("group", { name: language === "ru" ? "Период анализа" : "Tahlil davri" });
  await expect(period).toBeVisible({ timeout: 90_000 });
  return { period, leaked };
};

/** Davr tugmalari matni (segment radiolari) tartib bilan. */
export const periodLabels = async (page: Page, language: "uz" | "ru" = "uz") =>
  page.getByRole("radiogroup", { name: language === "ru" ? "Период" : "Davr" }).getByRole("radio").allInnerTexts();

export const UZ_PERIODS = ["Bugun", "Bu hafta", "Bu oy", "Barchasi"];
export const RU_PERIODS = ["Сегодня", "Эта неделя", "Этот месяц", "Все"];

/** Tahlil kontentida tarjima qilinmagan davr kalitlari («week / month / year») ko'rinmaydi. */
export const expectNoRawPeriodKeys = async (page: Page) => {
  const text = await page.locator("[data-shell-slot=content]").innerText();
  expect(text).not.toMatch(/\b(week|month|year)\b/);
};
