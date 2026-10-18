import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * GvL6ZFAd — market sahifasidagi «Telegram token» kartasi (maket `superadmin-users-detail`). Token umumiy
 * javoblarda yo'q: faqat `GET /markets/:id/tg-token` (FAQAT SUPERADMIN), «Ko'rsatish» bosilganda.
 * Boshqa rollar uchun karta yo'q va so'rov ketmaydi. Soxta backend, 1440px.
 */
const ORIGIN = "http://127.0.0.1:4173";
const TOKEN = "group_token-0123456789abcdef0123456789abcdef";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const MARKET = {
  id: "201",
  name: "Baraka Shop",
  phone_number: "+998901234567",
  username: "baraka",
  role: "market",
  status: "active",
  salary: 0,
  payment_day: null,
  tariff_home: 30000,
  tariff_center: 20000,
  default_tariff: "center",
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-30T09:00:00.000Z",
  is_deleted: false,
};

const mockApi = async (page: Page, role: "superadmin" | "admin") => {
  const tokenRequests: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, { statusCode: 200, data: { id: "1", role, name: "E2E", status: "active" } });
    if (path === "users/201") return reply(route, { statusCode: 200, data: MARKET });
    if (path === "markets/201/tg-token") {
      tokenRequests.push(request.method());
      return reply(route, { statusCode: 200, data: { id: "201", market_tg_token: TOKEN } });
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
  return { tokenRequests };
};

test.describe("Market Telegram tokeni — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin: token yashirin, «Ko'rsatish» — `GET /markets/:id/tg-token` orqali ochiladi", async ({ page }) => {
    const { tokenRequests } = await mockApi(page, "superadmin");
    await page.goto("/all-users/201");

    const card = page.getByRole("region", { name: "Telegram token" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await expect(card.getByTestId("telegram-token-value")).toContainText("••••••••••••••••");
    expect(tokenRequests).toEqual([]);

    await card.getByRole("button", { name: "Ko'rsatish" }).click();
    await expect(card.getByTestId("telegram-token-value")).toHaveText(TOKEN);
    await expect(card.getByRole("button", { name: "Yashirish" })).toBeVisible();
    expect(tokenRequests).toEqual(["GET"]);
  });

  test("⭐ admin: karta yo'q va token so'ralmaydi (endpoint faqat SUPERADMIN)", async ({ page }) => {
    const { tokenRequests } = await mockApi(page, "admin");
    await page.goto("/all-users/201");

    await expect(page.getByText("Baraka Shop").first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("region", { name: "Telegram token" })).toHaveCount(0);
    expect(tokenRequests).toEqual([]);
  });
});
