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

/**
 * `GET /finance/pnl?from_day&granularity=month` soxta javobi (tizim P&L kartasi): `from_day` oyidan joriy oygacha HAR
 * oy, backend kabi (bo'sh oy — 0). Qiymatlar qat'iy: bitta zarar oyi, bitta qo'lda kirim, birinchi oylar bo'sh.
 */
export const pnlDemo = (fromDay: string | null, now: Date = new Date()) => {
  const fallback = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const start =
    fromDay && /^\d{4}-\d{2}-\d{2}$/.test(fromDay)
      ? fromDay
      : `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, "0")}-01`;
  const [year, month] = start.split("-").map(Number);
  const last = now.getFullYear() * 12 + now.getMonth();
  const items: Array<{ period: string; gross: number; opex: number; net: number; other_income: number }> = [];
  for (let index = year * 12 + month - 1; index <= last; index += 1) {
    const age = last - index; // 0 — joriy oy
    const gross = age > 13 ? 0 : age === 0 ? 31_400_000 : 36_000_000 + ((age * 7) % 5) * 2_350_000;
    const opex = age > 13 ? 0 : age === 0 ? 22_900_000 : age === 3 ? 47_800_000 : 21_000_000 + ((age * 3) % 4) * 1_900_000;
    items.push({
      period: `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
      gross,
      opex,
      net: gross - opex,
      other_income: age === 5 ? 10_000_000 : 0,
    });
  }
  const total = (key: "gross" | "opex" | "net" | "other_income") => items.reduce((sum, item) => sum + item[key], 0);
  return {
    statusCode: 200,
    message: "P&L series",
    data: {
      from_day: start,
      to_day: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      granularity: "month",
      items,
      totals: { gross: total("gross"), opex: total("opex"), net: total("net"), other_income: total("other_income") },
    },
  };
};

export const openBalanceAnalysis = async (page: Page, { language = "uz", theme = "light" }: BalanceSession = {}) => {
  const leaked: string[] = [];
  const pnlRequests: URLSearchParams[] = [];
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
    if (path === "finance/pnl") {
      pnlRequests.push(url.searchParams);
      return reply(route, pnlDemo(url.searchParams.get("from_day")));
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
  return { period, leaked, pnlRequests };
};

/**
 * Davr tugmalari matni (segment radiolari) tartib bilan. Nom aniq (`exact`): tepadagi P&L kartasining «Grafik davri»
 * («Период графика») segmenti ham «Davr» ni o'z ichiga oladi.
 */
export const periodLabels = async (page: Page, language: "uz" | "ru" = "uz") =>
  page
    .getByRole("radiogroup", { name: language === "ru" ? "Период" : "Davr", exact: true })
    .getByRole("radio")
    .allInnerTexts();

export const UZ_PERIODS = ["Bugun", "Bu hafta", "Bu oy", "Barchasi"];
export const RU_PERIODS = ["Сегодня", "Эта неделя", "Этот месяц", "Все"];

/** Tahlil kontentida tarjima qilinmagan davr kalitlari («week / month / year») ko'rinmaydi. */
export const expectNoRawPeriodKeys = async (page: Page) => {
  const text = await page.locator("[data-shell-slot=content]").innerText();
  expect(text).not.toMatch(/\b(week|month|year)\b/);
};
