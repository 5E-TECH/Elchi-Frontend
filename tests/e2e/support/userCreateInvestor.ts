import { expect, test, type Page, type Route } from "@playwright/test";
import { toast } from "./toast";

/**
 * «Foydalanuvchi qo'shish» → Investor (ega so'rovi 2026-11-05, BeePost naqshi; maket yo'q — eng yaqini
 * `superadmin-users-create`). Soxta gateway: `POST investor-users` (sukut — parolni tizim yaratadi va SMS qiladi) →
 * 201 + `data.investor` (shu telefondagi investor yozuvi loginga bog'langan), keyin boshlang'ich kapital —
 * `POST investments`, natija oynasi «Foydalanuvchi yaratildi». Serverga so'rov ketmaydi.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;

type Calls = { investorUsers: Array<Record<string, unknown>>; investments: Array<Record<string, unknown>> };

export const mockInvestorGateway = async (page: Page, { theme = "light" }: { theme?: "light" | "dark" } = {}) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const calls: Calls = { investorUsers: [], investments: [] };
  const sms = {
    status: "sent",
    failure_reason: null,
    failure_message: null,
    requested_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    delivered_at: null,
    resend_available_at: null,
    resends_left_today: 3,
  };

  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: {
          id: "1",
          role: "superadmin",
          name: "E2E",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "investor-users" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.investorUsers.push(body);
      return reply(
        route,
        {
          statusCode: 201,
          message: "Investor login yaratildi",
          data: {
            id: "81",
            name: body.name,
            phone_number: body.phone_number,
            role: "investor",
            password_mode: "generate_sms",
            password_sms: sms,
            investor: { id: "5", user_id: "81", name: body.name, phone_number: body.phone_number },
          },
        },
        201,
      );
    }
    if (path === "users/81/password/sms-status") return reply(route, { statusCode: 200, data: sms });
    if (path === "investments" && request.method() === "POST") {
      calls.investments.push(request.postDataJSON() as Record<string, unknown>);
      return reply(route, { statusCode: 201, data: { id: "9" } }, 201);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return calls;
};

export const openInvestorForm = async (page: Page) => {
  await page.goto("/all-users/create-user?role=investor");
  const content = page.locator("[data-shell-slot=content]");
  const form = content.getByRole("form", { name: "Investor qo'shish" });
  await expect(form).toBeVisible({ timeout: 90_000 });
  return { content, form };
};

export const runCreateInvestorScenarios = (label: string, { mobile = false }: { mobile?: boolean } = {}) => {
  test(`⭐ superadmin investor yaratadi — login + boshlang'ich kapital (${label})`, async ({ page }) => {
    const calls = await mockInvestorGateway(page);
    const { content, form } = await openInvestorForm(page);

    await expect(content.getByRole("radio", { name: /^Investor/ })).toBeChecked();
    await expect(form.getByRole("heading", { level: 3, name: "Investitsiya" })).toBeVisible();
    await expect(form.getByRole("combobox", { name: "Filial" })).toHaveCount(0);

    await form.getByRole("textbox", { name: "Ism familiya" }).fill("ali investor");
    await form.getByRole("textbox", { name: "Telefon" }).pressSequentially("901234567");
    await form.getByRole("textbox", { name: "Boshlang'ich kapital" }).pressSequentially("100000000");

    if (mobile) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }

    await page.getByRole("button", { name: "Yaratish va SMS yuborish" }).click();

    await expect.poll(() => calls.investorUsers.length).toBe(1);
    expect(calls.investorUsers[0]).toEqual({
      name: "Ali Investor",
      phone_number: "+998901234567",
      password_mode: "generate_sms",
    });
    await expect.poll(() => calls.investments.length).toBe(1);
    expect(calls.investments[0]).toMatchObject({ investor_id: "5", amount: 100000000 });
    await expect(page.getByRole("dialog", { name: "Foydalanuvchi yaratildi" })).toBeVisible();
    await expect(toast(page, "Kapital yozilmadi")).toHaveCount(0);
  });
};
