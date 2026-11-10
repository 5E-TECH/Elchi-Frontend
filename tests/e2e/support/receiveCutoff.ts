import { expect, type Page } from "@playwright/test";

/**
 * «Kun tartibi» (Ops, 2026-11-10) — yaratilgan buyurtmalarni qabul qilish chegarasi o'tgan holat. Sahifaning o'z soxta
 * backendi ustidan (`mockNewOrdersCameraApi`, `mockIncomingApi`) faqat `GET orders/intake-settings` almashtiriladi:
 * yangi backend javobi (`receive_*`) — 16:00 dan keyin qabul yopiq, kun almashganda (6 soatdan keyin) ochiladi.
 * `page.route` kontekst marshrutidan ustun; boshqa so'rovlar (preflight ham) sahifaning o'z soxtasiga o'tadi.
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const HOUR = 3_600_000;

export const RECEIVE_CLOSED_TITLE = "Bugungi qabul vaqti tugadi (16:00)";
export const RECEIVE_CLOSED_REOPENS = /Yangi buyurtmalarni qabul qilish \d\d:\d\d da, kun almashganda ochiladi\./;

export const closeReceive = async (page: Page) => {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  await page.route("**/orders/intake-settings", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify({
            statusCode: 200,
            message: "ok",
            data: {
              cutoff_time: null,
              is_open: true,
              closes_at: null,
              reopens_at: null,
              receive_cutoff_time: "16:00",
              receive_is_open: false,
              receive_closes_at: iso(now - HOUR),
              receive_reopens_at: iso(now + 6 * HOUR),
              day_change_time: "00:00",
              day_started_at: iso(now - 18 * HOUR),
              next_day_change_at: iso(now + 6 * HOUR),
            },
          }),
        })
      : route.fallback(),
  );
};

/**
 * Mavzu: ilova kirgach profil sozlamasini (`settings.appearance`, faqat `themeChosen: true` bo'lsa) qo'llaydi —
 * `mockNewOrdersCameraApi` va `mockIncomingApi` dagi o'sha superadmin profili («Bosh admin», id 1) mavzu bilan beriladi;
 * `localStorage` — profil kelguncha miltillamasin.
 */
export const serveSuperadminTheme = async (page: Page, theme: "light" | "dark") => {
  await page.route("**/auth/my-profile", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify({
            statusCode: 200,
            message: "ok",
            data: {
              id: "1",
              role: "superadmin",
              name: "Bosh admin",
              status: "active",
              settings: { appearance: { theme, themeChosen: true } },
            },
          }),
        })
      : route.fallback(),
  );
  await page.addInitScript((value) => {
    window.localStorage.setItem("theme-version", "2");
    window.localStorage.setItem("theme", value);
  }, theme);
};

export const expectTheme = async (page: Page, theme: "light" | "dark") => {
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
  else await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
};

/** Ogohlantirish matni: sarlavha + ochilish vaqti (market sahifasida ham, kiruvchi posilkalarda ham bir xil). */
export const expectReceiveClosedAlert = async (page: Page, testId: string) => {
  const alert = page.getByTestId(testId);
  await expect(alert).toBeVisible({ timeout: 60_000 });
  await expect(alert).toHaveAttribute("role", "status");
  // Sarlavha va matn bitta blokda (`.el-alert`: qalin sarlavha + matn) — ikkalasi ham shu blok ichida.
  await expect(alert).toContainText(RECEIVE_CLOSED_TITLE);
  await expect(alert).toContainText(RECEIVE_CLOSED_REOPENS);
  return alert;
};

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
