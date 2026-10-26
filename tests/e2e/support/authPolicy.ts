import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * NDmZMzCP e2e (soxta gateway): login qulfi — `POST auth/login` 429 `{ code: "LOGIN_LOCKED", retry_after_seconds }`;
 * zaif parol — login javobida `must_change_password: true` → «Yangi parol o'rnating» oynasi, `PATCH auth/my-profile
 * { password }` dan keyin `POST auth/refresh` bayroqsiz token beradi.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;
const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const TOKEN = `${b64url({ alg: "HS256" })}.${b64url({ id: "77", role: "manager", sid: "e2e-sid" })}.sig`;
const PROFILE = { id: "77", role: "manager", name: "E2E menejer", phone_number: "+998901234567", status: "active" };

export const mockAuthPolicy = async (
  page: Page,
  scenario: { loginLockedSeconds?: number; mustChangePassword?: boolean },
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
  const state = { mustChange: Boolean(scenario.mustChangePassword) };
  const calls = { login: 0, refresh: 0, passwordPatches: [] as unknown[] };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/login") {
      calls.login += 1;
      if (scenario.loginLockedSeconds) {
        const minutes = Math.ceil(scenario.loginLockedSeconds / 60);
        return reply(
          route,
          {
            statusCode: 429,
            message: `Juda ko'p noto'g'ri urinish — ${minutes} daqiqadan keyin qayta urinib ko'ring`,
            code: "LOGIN_LOCKED",
            retry_after_seconds: scenario.loginLockedSeconds,
          },
          429,
        );
      }
      return reply(route, { accessToken: TOKEN, must_change_password: state.mustChange });
    }
    if (path === "auth/refresh") {
      calls.refresh += 1;
      return reply(route, { accessToken: TOKEN, must_change_password: state.mustChange });
    }
    if (path === "auth/my-profile") {
      if (request.method() === "PATCH") {
        calls.passwordPatches.push(request.postDataJSON());
        state.mustChange = false;
      }
      return reply(route, { statusCode: 200, message: "ok", data: PROFILE });
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    return reply(route, { statusCode: 200, message: "ok", data: [] });
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  return { calls };
};

export const submitLogin = async (page: Page, password = "eski-parol") => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 90_000 });
  await page.locator('input[name="elchi-login-phone"]').fill("901234567");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Kirish" }).click();
};

export const runAuthPolicyScenarios = () => {
  test("429 LOGIN_LOCKED — «Juda ko'p noto'g'ri urinish», «4 daqiqadan keyin…», «Kirish» o'chiq", async ({ page }) => {
    const { calls } = await mockAuthPolicy(page, { loginLockedSeconds: 200 });
    await submitLogin(page);
    const alert = page.getByRole("form", { name: "Tizimga kirish" }).getByRole("alert");
    await expect(alert).toContainText("Juda ko'p noto'g'ri urinish");
    await expect(alert).toContainText("4 daqiqadan keyin qayta urinib ko'ring.");
    await expect(page.getByRole("button", { name: "Kirish" })).toBeDisabled();
    expect(calls.login).toBe(1);
  });

  test("must_change_password — «Yangi parol o'rnating» oynasi; «Keyinroq» bloklamaydi", async ({ page }) => {
    await mockAuthPolicy(page, { mustChangePassword: true });
    await submitLogin(page);
    const dialog = page.getByRole("dialog", { name: "Yangi parol o'rnating" });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText("Kamida 10 ta belgi");
    await expect(page).toHaveURL(/\/branch-dashboard/);
    await dialog.getByRole("button", { name: "Keyinroq" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/branch-dashboard/);
  });

  test("must_change_password — yangi parol saqlanadi → refresh → oyna yopiladi", async ({ page }) => {
    const { calls } = await mockAuthPolicy(page, { mustChangePassword: true });
    await submitLogin(page);
    const dialog = page.getByRole("dialog", { name: "Yangi parol o'rnating" });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const inputs = dialog.locator('input[autocomplete="new-password"]');
    await inputs.nth(0).fill("qisqa123");
    await inputs.nth(1).fill("qisqa123");
    await dialog.getByRole("button", { name: "Parolni saqlash" }).click();
    await expect(dialog).toContainText("Parol kamida 10 ta belgidan iborat bo'lsin");
    expect(calls.passwordPatches).toEqual([]);

    await inputs.nth(0).fill("Yangi-Parol-2026");
    await inputs.nth(1).fill("Yangi-Parol-2026");
    await dialog.getByRole("button", { name: "Parolni saqlash" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    expect(calls.passwordPatches).toEqual([{ password: "Yangi-Parol-2026" }]);
    await expect.poll(() => calls.refresh).toBeGreaterThanOrEqual(1);
    await expect(page.getByText("Yangi parol o'rnatildi", { exact: true }).first()).toBeVisible();
  });
};
