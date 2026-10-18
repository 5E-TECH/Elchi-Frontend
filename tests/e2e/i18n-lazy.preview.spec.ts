import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

/**
 * TARJIMALAR KERAK BO'LGANDA YUKLANADI (NIFAnCvf) — PROD BUILD.
 * uz bundle ichida; ru / en — alohida `locale-<til>` chunk, faqat tanlanganda.
 */
const ORIGIN = "http://127.0.0.1:4175";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const setup = async (context: BrowserContext, language: "uz" | "ru") => {
  let settings: Record<string, unknown> = { appearance: { theme: "dark", language } };
  await context.route(/api\.elchipochta\.uz|:3004\//, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active", settings } });
    }
    if (path === "auth/my-settings" && request.method() === "PATCH") {
      settings = (request.postDataJSON() as { settings: Record<string, unknown> }).settings;
      return reply(route, { statusCode: 200, data: { settings } });
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await context.addInitScript((lang) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("app-language", lang);
    // Yuklanish davomida DOM'da BIRORTA o'zbekcha tab nomi paydo bo'ldimi?
    const w = window as unknown as { __uzSeen: boolean };
    w.__uzSeen = false;
    new MutationObserver(() => {
      if (document.body?.textContent?.includes("Ko'rinish")) w.__uzSeen = true;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  }, language);
};

const scriptsOf = (page: Page) => {
  const scripts: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === ORIGIN && url.pathname.endsWith(".js")) scripts.push(decodeURIComponent(url.pathname));
  });
  return scripts;
};

test.describe("Tarjimalar — kerak bo'lganda yuklanadi", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("⭐ ru tanlangan foydalanuvchi: sahifa ruscha ochiladi, o'zbekcha bir lahza ham ko'rinmaydi; faqat locale-ru", async ({ page, context }) => {
    await setup(context, "ru");
    const scripts = scriptsOf(page);
    await page.goto("/settings");

    await expect(page.getByRole("main").getByRole("tab", { name: /Внешний вид/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("main").getByRole("tab", { name: /Уведомления/ })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __uzSeen: boolean }).__uzSeen)).toBe(false);
    expect(scripts.some((path) => /locale-ru-/.test(path))).toBe(true);
    expect(scripts.some((path) => /locale-en-/.test(path))).toBe(false);
  });

  test("⭐ uz → English: til fayli faqat tanlanganda yuklanadi va matn darhol inglizchaga o'tadi", async ({ page, context }) => {
    await setup(context, "uz");
    const scripts = scriptsOf(page);
    await page.goto("/settings");
    await expect(page.getByRole("main").getByRole("tab", { name: /Ko'rinish/ })).toBeVisible({ timeout: 60_000 });
    expect(scripts.some((path) => /locale-(ru|en)-/.test(path))).toBe(false);

    // Dizayn v2: til — radio-kartalar (yashirin `<input type="radio">` ni o'rab turgan `label` bosiladi).
    await page.locator("label", { has: page.getByRole("radio", { name: /English/ }) }).click();

    await expect(page.getByRole("main").getByRole("tab", { name: /Appearance/ })).toBeVisible();
    await expect(page.getByRole("main").getByRole("tab", { name: /Notifications/ })).toBeVisible();
    expect(scripts.some((path) => /locale-en-/.test(path))).toBe(true);
    expect(scripts.some((path) => /locale-ru-/.test(path))).toBe(false);

    // Qayta yuklanganda ham inglizcha (tanlov saqlangan).
    await page.reload();
    await expect(page.getByRole("main").getByRole("tab", { name: /Appearance/ })).toBeVisible({ timeout: 60_000 });
  });
});
