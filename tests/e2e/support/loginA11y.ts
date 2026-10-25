import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * `/login` a11y e2e (XsoWhKP5 «2368f6»): soxta gateway — `POST auth/login` 401 qaytaradi (parol noto'g'ri),
 * boshqa so'rov tarmoqqa chiqmaydi. Ilova manzili `playwright.config.ts` dagi `baseURL` dan.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;

export const mockLoginApi = async (page: Page) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status: number) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const logins: unknown[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/login") {
      logins.push(request.postDataJSON());
      // Xom backend matni foydalanuvchiga ko'rsatilmasligi kerak.
      return reply(route, { statusCode: 401, message: "Invalid credentials RAW", error: "Unauthorized" }, 401);
    }
    return reply(route, { statusCode: 401, message: "Unauthorized" }, 401);
  });
  return { logins };
};

export const openLogin = async (page: Page) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 90_000 });
};

/** Ekran o'quvchi uchun tavsif: `aria-describedby` dagi id'lar matni (bo'sh joy bilan). */
export const describedText = (page: Page, selector: string) =>
  page.locator(selector).evaluate((input) =>
    (input.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? `<${id} yo'q>`)
      .join(" | "),
  );
