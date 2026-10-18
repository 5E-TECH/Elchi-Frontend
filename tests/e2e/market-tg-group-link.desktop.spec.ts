import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * 4TfLyTrL / 6jXw0DDr — market sahifasidagi «Telegram guruhi» kartasi (eski «Telegram token» o'rnida; matnli
 * token bilan ulash backendda o'chirilgan). Tugma «Bildirishnoma qo'shish» oynasini shu market tanlangan holda
 * ochadi → `POST /telegram/link-code { purpose: "market_group", group_type, market_id }` → QR va
 * `t.me/<bot>?startgroup=<kod>`. Faqat superadmin; `GET /markets/:id/tg-token` hech qachon so'ralmaydi.
 * Soxta backend, 1440px.
 */
const ORIGIN = "http://127.0.0.1:4173";
const DEEP_LINK = "https://t.me/elchi_bot?startgroup=c0de42";
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
  const linkRequests: unknown[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, { statusCode: 200, data: { id: "1", role, name: "E2E", status: "active" } });
    if (path === "users/201") return reply(route, { statusCode: 200, data: MARKET });
    if (path === "markets") return reply(route, { statusCode: 200, data: [MARKET] });
    if (path.endsWith("/tg-token")) {
      tokenRequests.push(request.method());
      return reply(route, { statusCode: 200, data: {} });
    }
    if (path === "telegram/link-code" && request.method() === "POST") {
      const body = request.postDataJSON() as { group_type?: string };
      linkRequests.push(body);
      return reply(route, {
        statusCode: 200,
        data: {
          token: "c0de42",
          purpose: "market_group",
          group_type: body.group_type,
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          deep_link: DEEP_LINK,
          command: "/start c0de42",
        },
      });
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
  return { tokenRequests, linkRequests };
};

test.describe("Market Telegram guruhi (bir martalik havola) — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin: «Telegram guruhi» kartasi → oyna shu market bilan → bir martalik havola va QR", async ({ page }) => {
    const { tokenRequests, linkRequests } = await mockApi(page, "superadmin");
    await page.goto("/all-users/201");

    const card = page.getByRole("region", { name: "Telegram guruhi" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("region", { name: "Telegram token" })).toHaveCount(0);

    await card.getByRole("button", { name: "Ulash havolasini olish" }).click();
    const dialog = page.getByRole("dialog", { name: "Bildirishnoma qo'shish" });
    await expect(dialog).toBeVisible();
    // Market oldindan tanlangan — qidiruvli tanlov maydonining qiymati.
    await expect(dialog.getByRole("combobox").first()).toHaveValue(/Baraka Shop/);

    await dialog.getByText("Bekor qilinganlar guruhi").click();
    await dialog.getByRole("button", { name: "Ulash havolasini olish" }).click();

    await expect(dialog.getByRole("link", { name: /Telegram'da ochish/ })).toHaveAttribute("href", DEEP_LINK);
    expect(linkRequests).toEqual([{ purpose: "market_group", group_type: "cancel", market_id: "201" }]);
    expect(tokenRequests).toEqual([]);
  });

  test("⭐ admin: karta yo'q (guruh ulash oynasi faqat superadminda), token so'ralmaydi", async ({ page }) => {
    const { tokenRequests } = await mockApi(page, "admin");
    await page.goto("/all-users/201");

    await expect(page.getByText("Baraka Shop").first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("region", { name: "Telegram guruhi" })).toHaveCount(0);
    expect(tokenRequests).toEqual([]);
  });
});
