import { expect, test, type Page, type Route } from "@playwright/test";
import { toast } from "./toast";

/**
 * aidsxJ2H e2e (soxta gateway).
 *
 * 1) Birinchi kirish (parolni tizim bergan): login javobida `must_change_password: true`, token'da `pwd_forced: true`;
 *    parol almashtirilmaguncha boshqa har so'rov 403 `PASSWORD_CHANGE_REQUIRED`. `PATCH auth/my-profile` —
 *    `old_password` noto'g'ri bo'lsa 400 `OLD_PASSWORD_INVALID` (401 emas); to'g'ri — bayroq tushadi, `POST auth/refresh`
 *    bayroqsiz token beradi.
 * 2) Foydalanuvchi yaratish (superadmin): `POST couriers` `password_mode: generate_sms` → 201 + `password_sms`
 *    (Eskiz TEST rejimi — `failed` / `provider_rejected`); `POST users/:id/password/resend-sms` → yangi SMS
 *    (`pending`), `GET users/:id/password/sms-status` → `sent` → `delivered`.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;
const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`;
const wrap = (data: unknown, statusCode = 200) => ({ statusCode, message: "ok", data });

export const TEMP_PASSWORD = "Vaqtinchalik9";

const corsFor = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-expose-headers": "Retry-After",
});

export const mockForcedFirstLogin = async (page: Page) => {
  const origin = appOrigin();
  const cors = corsFor(origin);
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const profile = { id: "88", role: "courier", name: "Yangi Kuryer", phone_number: "+998901112233", status: "active" };
  const forcedToken = jwt({ id: "88", role: "courier", sid: "e2e-sid", pwd_change: true, pwd_forced: true });
  const plainToken = jwt({ id: "88", role: "courier", sid: "e2e-sid" });
  const state = { forced: true };
  const calls = { patches: [] as unknown[], refresh: 0, logout: 0, gated: 0 };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/login") {
      return reply(route, { accessToken: forcedToken, must_change_password: true });
    }
    if (path === "auth/refresh") {
      calls.refresh += 1;
      return reply(route, {
        accessToken: state.forced ? forcedToken : plainToken,
        must_change_password: state.forced,
      });
    }
    if (path === "auth/logout") {
      calls.logout += 1;
      return reply(route, wrap({ ok: true }));
    }
    if (path === "auth/my-profile") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as { old_password?: string; password?: string };
        calls.patches.push(body);
        if (!body.old_password) {
          return reply(route, { statusCode: 400, message: "Joriy parolni kiriting", code: "OLD_PASSWORD_REQUIRED" }, 400);
        }
        if (body.old_password !== TEMP_PASSWORD) {
          return reply(route, { statusCode: 400, message: "Joriy parol noto'g'ri", code: "OLD_PASSWORD_INVALID" }, 400);
        }
        state.forced = false;
      }
      return reply(route, wrap(profile));
    }
    if (state.forced) {
      calls.gated += 1;
      return reply(
        route,
        { statusCode: 403, message: "Avval parolni almashtiring", code: "PASSWORD_CHANGE_REQUIRED" },
        403,
      );
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    return reply(route, wrap([]));
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  return { calls, state };
};

export const loginAs = async (page: Page, password: string) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 90_000 });
  await page.locator('input[name="elchi-login-phone"]').fill("901112233");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Kirish" }).click();
};

type SmsState = {
  status: "pending" | "sent" | "delivered" | "failed";
  failure_reason: string | null;
  failure_message: string | null;
  requested_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  resend_available_at: string;
  resends_left_today: number;
};

export const mockCreateUserSms = async (page: Page, options: { theme?: "light" | "dark" } = {}) => {
  const origin = appOrigin();
  const cors = corsFor(origin);
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const nowIso = () => new Date().toISOString();
  const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
  let sms: SmsState | null = null;
  let statusReads = 0;
  const creates: unknown[] = [];
  const resends: string[] = [];
  const leaked: string[] = [];

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({
          id: "1",
          role: "superadmin",
          name: "Bosh admin",
          status: "active",
          settings: { appearance: { theme: options.theme ?? "light", themeChosen: true } },
        }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === "couriers" && request.method() === "POST") {
      const body = request.postDataJSON() as { name: string; phone_number: string };
      creates.push(body);
      // prod'dagi kabi: Eskiz TEST rejimi — haqiqiy matn rad etiladi.
      sms = {
        status: "failed",
        failure_reason: "provider_rejected",
        failure_message: "SMS provayder xabarni rad etdi (balans yoki shablon tasdig'ini tekshiring)",
        requested_at: nowIso(),
        sent_at: null,
        delivered_at: null,
        resend_available_at: inSeconds(-1),
        resends_left_today: 5,
      };
      return reply(
        route,
        wrap(
          {
            id: "91",
            name: body.name,
            phone_number: body.phone_number,
            role: "courier",
            status: "active",
            password_mode: "generate_sms",
            password_sms: sms,
          },
          201,
        ),
        201,
      );
    }
    if (path === "users/91/password/resend-sms" && request.method() === "POST") {
      resends.push(path);
      if (sms && Date.parse(sms.resend_available_at) > Date.now()) {
        const wait = Math.ceil((Date.parse(sms.resend_available_at) - Date.now()) / 1000);
        return reply(
          route,
          { statusCode: 429, message: `SMS'ni qayta yuborish ${wait} soniyadan keyin mumkin`, code: "PASSWORD_SMS_COOLDOWN", retry_after_seconds: wait },
          429,
        );
      }
      sms = {
        status: "pending",
        failure_reason: null,
        failure_message: null,
        requested_at: nowIso(),
        sent_at: null,
        delivered_at: null,
        resend_available_at: inSeconds(60),
        resends_left_today: 4,
      };
      statusReads = 0;
      return reply(route, wrap({ user_id: "91", must_change_password: true, password_sms: sms }));
    }
    if (path === "users/91/password/sms-status") {
      statusReads += 1;
      if (sms && sms.status === "pending" && statusReads >= 1) sms = { ...sms, status: "sent", sent_at: nowIso() };
      else if (sms && sms.status === "sent" && statusReads >= 2) sms = { ...sms, status: "delivered", delivered_at: nowIso() };
      return reply(route, wrap({ user_id: "91", must_change_password: true, password_sms: sms }));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.addInitScript((theme) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    if (theme) {
      window.localStorage.setItem("theme", theme);
      window.localStorage.setItem("theme-version", "2");
    }
  }, options.theme ?? null);
  return { creates, resends, leaked };
};

/** Tekshiruv skrinshotlari (commit qilinmaydi): `E2E_SHOTS_DIR` berilsa shu papkaga. */
export const shot = async (page: Page, name: string) => {
  const dir = process.env.E2E_SHOTS_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
};

/** Gorizontal skroll yo'q (390px). */
export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

/** Ikkala o'lcham (1440 / 390) uchun umumiy ssenariylar. `suffix` — skrinshot nomi. */
export const runUserPasswordSmsScenarios = (suffix: string, { mobile = false }: { mobile?: boolean } = {}) => {
  test("birinchi kirish (pwd_forced): bloklovchi oyna, 400 OLD_PASSWORD_INVALID chiqarmaydi, to'g'ri parol → refresh → ilova ochiladi", async ({ page }) => {
    const { calls, state } = await mockForcedFirstLogin(page);
    await loginAs(page, TEMP_PASSWORD);

    const dialog = page.getByRole("dialog", { name: "Yangi parol o'rnating" });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText("vaqtinchalik parol bilan kirdingiz");
    await expect(dialog.getByText("Joriy (vaqtinchalik) parol")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keyinroq" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Yopish" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Chiqish" })).toBeVisible();
    await shot(page, `forced-dialog-${suffix}`);
    if (mobile) await expectNoHorizontalOverflow(page);

    // Esc yopmaydi; 403 PASSWORD_CHANGE_REQUIRED uchun «Ma'lumotni yuklab bo'lmadi» xabarlari chiqmaydi.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect.poll(() => calls.gated, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(toast(page, "Ma'lumotni yuklab bo'lmadi")).toHaveCount(0);

    const current = dialog.locator('input[autocomplete="current-password"]');
    const next = dialog.locator('input[autocomplete="new-password"]');
    await current.fill("Notogri-parol1");
    await next.nth(0).fill("Ozimniki-2026");
    await next.nth(1).fill("Ozimniki-2026");
    await dialog.getByRole("button", { name: "Parolni saqlash" }).click();
    await expect(dialog.getByText("Joriy parol noto'g'ri")).toBeVisible();
    await expect(current).toHaveAttribute("aria-invalid", "true");
    await expect(page).not.toHaveURL(/\/login/);
    expect(calls.logout).toBe(0);
    await shot(page, `forced-dialog-invalid-${suffix}`);

    await current.fill(TEMP_PASSWORD);
    await dialog.getByRole("button", { name: "Parolni saqlash" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    expect(calls.patches.at(-1)).toEqual({ old_password: TEMP_PASSWORD, password: "Ozimniki-2026" });
    expect(state.forced).toBe(false);
    await expect.poll(() => calls.refresh).toBeGreaterThanOrEqual(1);
    expect(calls.logout).toBe(0);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("birinchi kirish: «Chiqish» — tizimdan chiqadi", async ({ page }) => {
    const { calls } = await mockForcedFirstLogin(page);
    await loginAs(page, TEMP_PASSWORD);
    const dialog = page.getByRole("dialog", { name: "Yangi parol o'rnating" });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole("button", { name: "Chiqish" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    expect(calls.patches).toEqual([]);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`kuryer yaratish — SMS (sukut): parolsiz so'rov, natija oynasi, sabab, qayta yuborish → yetkazildi (${theme})`, async ({ page }) => {
      const mock = await mockCreateUserSms(page, { theme });
      await page.goto("/all-users/create-user?role=courier");
      const form = page.getByRole("form", { name: /Kuryer/ });
      await expect(form).toBeVisible({ timeout: 90_000 });

      await expect(form.getByRole("radio", { name: /^Tizim yaratsin va SMS yuborsin/ })).toBeChecked();
      await expect(form.locator('input[name="password"]')).toHaveCount(0);
      await form.locator('input[name="fullName"]').fill("Sardor Qodirov");
      await form.locator('input[name="phone"]').fill("901234567");
      await form.locator('input[name="homeRate"]').fill("25000");
      await form.locator('input[name="centerRate"]').fill("18000");
      await expect(form).toContainText("+998 90 123 45 67 raqamiga SMS qilib yuboriladi");
      if (mobile) await expectNoHorizontalOverflow(page);
      await form.getByText("Parol", { exact: true }).scrollIntoViewIfNeeded();
      await shot(page, `create-sms-form-${suffix}-${theme}`);

      await form.getByRole("button", { name: "Yaratish va SMS yuborish" }).click();
      const dialog = page.getByRole("dialog", { name: "Foydalanuvchi yaratildi" });
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      expect(mock.creates).toHaveLength(1);
      expect(mock.creates[0]).toMatchObject({ name: "Sardor Qodirov", phone_number: "+998901234567", password_mode: "generate_sms" });
      expect(mock.creates[0]).not.toHaveProperty("password");

      await expect(dialog).toContainText("SMS yuborilmadi");
      await expect(dialog).toContainText("SMS provayder xabarni rad etdi");
      await expect(dialog).toContainText("«Qo'lda kiritish»ni tanlang");
      await shot(page, `result-failed-${suffix}-${theme}`);
      if (mobile) await expectNoHorizontalOverflow(page);

      await dialog.getByRole("button", { name: /SMSni qayta yuborish/ }).click();
      await expect(dialog).toContainText("Yetkazildi", { timeout: 20_000 });
      await expect(dialog.getByRole("button", { name: /SMSni qayta yuborish/ })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: /SMSni qayta yuborish/ })).toContainText(/\d:\d\d/);
      expect(mock.resends).toHaveLength(1);
      await shot(page, `result-delivered-${suffix}-${theme}`);

      await dialog.getByRole("button", { name: "Foydalanuvchiga o'tish" }).click();
      await expect(page).toHaveURL(/\/all-users\/91$/);
      expect(mock.leaked).toEqual([]);
    });
  }

  test("«Qo'lda kiritish» — parol maydoni va «birinchi kirishda almashtirsin», so'rovda manual", async ({ page }) => {
    const mock = await mockCreateUserSms(page);
    await page.goto("/all-users/create-user?role=courier");
    const form = page.getByRole("form", { name: /Kuryer/ });
    await expect(form).toBeVisible({ timeout: 90_000 });
    await form.getByText("Qo'lda kiritish", { exact: true }).click();
    await form.locator('input[name="fullName"]').fill("Lola Kuryerova");
    await form.locator('input[name="phone"]').fill("901112233");
    await form.locator('input[name="password"]').fill("lola2026ok");
    await form.locator('input[name="homeRate"]').fill("25000");
    await form.locator('input[name="centerRate"]').fill("15000");
    const mustChange = form.getByRole("checkbox", { name: "Birinchi kirishda parolni almashtirishni talab qilish" });
    await expect(mustChange).toBeChecked();
    await expect(mustChange).toBeEnabled();
    await shot(page, `create-manual-form-${suffix}`);
    await form.getByRole("button", { name: "Saqlash" }).click();
    await expect.poll(() => mock.creates.length).toBe(1);
    expect(mock.creates[0]).toMatchObject({ password_mode: "manual", password: "lola2026ok", must_change_password: true });
    await expect(page.getByRole("dialog", { name: "Foydalanuvchi yaratildi" })).toHaveCount(0);
  });
};
