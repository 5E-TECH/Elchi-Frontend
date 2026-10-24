import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * «Tarmoq xatoligi» (h0AM0kDL) e2e: soxta gateway, `POST auth/login` / `GET auth/my-profile` / `POST auth/refresh`
 * har biri ssenariy bo'yicha — `ok`, `abort` (darhol uzilish — brauzerda ERR_NETWORK), `hang` (javob yo'q —
 * 15 s dan keyin vaqt tugaydi) yoki `401`. Navbatdagi urinish ro'yxatdan olinadi, oxirgisi takrorlanadi.
 */
type Outcome = "ok" | "abort" | "hang" | "401";

const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
export const E2E_TOKEN = `${b64url({ alg: "HS256" })}.${b64url({ id: "77", role: "manager", sid: "e2e-sid" })}.sig`;
const PROFILE = { id: "77", role: "manager", name: "E2E menejer", status: "active" };

export const mockAuthNetwork = async (
  page: Page,
  scenario: { login?: Outcome[]; profile?: Outcome[]; refresh?: Outcome[] },
) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const calls = { login: 0, profile: 0, refresh: 0 };
  const next = (list: Outcome[] | undefined, index: number): Outcome => list?.[Math.min(index, list.length - 1)] ?? "ok";
  const answer = async (route: Route, outcome: Outcome, body: unknown) => {
    if (outcome === "abort") return route.abort("internetdisconnected");
    if (outcome === "hang") return; // javob berilmaydi — axios 15 s dan keyin ECONNABORTED
    if (outcome === "401") return reply(route, { statusCode: 401, message: "Unauthorized" }, 401);
    return reply(route, body, 200);
  };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/login") return answer(route, next(scenario.login, calls.login++), { accessToken: E2E_TOKEN });
    if (path === "auth/refresh") return answer(route, next(scenario.refresh, calls.refresh++), { accessToken: E2E_TOKEN });
    if (path === "auth/my-profile") {
      return answer(route, next(scenario.profile, calls.profile++), { statusCode: 200, message: "ok", data: PROFILE });
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    return reply(route, { statusCode: 200, message: "ok", data: [] });
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  return { calls };
};

export const setTheme = (page: Page, theme: "light" | "dark") =>
  page.addInitScript((value) => {
    window.localStorage.setItem("theme-version", "2");
    window.localStorage.setItem("theme", value);
  }, theme);

export const submitLogin = async (page: Page) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 90_000 });
  await page.locator('input[name="elchi-login-phone"]').fill("901234567");
  await page.locator('input[name="password"]').fill("parol123");
  await page.getByRole("button", { name: "Kirish" }).click();
};

export const loginAlert = (page: Page) => page.getByRole("form", { name: "Tizimga kirish" }).getByRole("alert");

/**
 * Kirildi: tabda token bor va `/` rol bosh sahifasiga yo'naltirdi (menejer — `/branch-dashboard`; bu faqat
 * bootstrap tugab, rol ma'lum bo'lgach bo'ladi), login formasi yo'q.
 */
export const expectSignedIn = async (page: Page) => {
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem("accessToken")), { timeout: 30_000 })
    .toBeTruthy();
  await expect(page).toHaveURL(/\/branch-dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("form", { name: "Tizimga kirish" })).toHaveCount(0);
};
