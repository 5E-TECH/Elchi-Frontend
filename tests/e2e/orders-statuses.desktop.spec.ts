import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * SllBYhnt — backend'ning ikki holati `/orders` ro'yxatida o'z nomi bilan (ega qarori: alohida yorliq):
 * `returned_to_market` — «Marketga topshirildi» (neytral), `waiting_customer` — «Mijoz kutilmoqda» (ogohlantirish).
 * «Yangi» ham, boshqa holat ham emas; «Holat» filtrida bor; `?status=returned_to_market` backend'ga uzatiladi;
 * noma'lum holat — neytral, xom nomi bilan. 1440px, soxta backend.
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const order = (id: number, status: string) => ({
  id: String(id),
  status,
  total_price: 150000,
  createdAt: "2026-10-16T08:00:00.000Z",
  customer: { name: `Mijoz ${id}`, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Chilonzor", region: { id: "1", name: "Toshkent" } },
  items: [],
});
const ORDERS = [order(1001, "returned_to_market"), order(1002, "waiting_customer"), order(1003, "lost_in_transit"), order(1004, "new")];

const mockOrders = async (page: Page) => {
  const listRequests: URLSearchParams[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return json(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (path === "orders") {
      listRequests.push(url.searchParams);
      const statuses = url.searchParams.get("status")?.split(",") ?? [];
      const items = statuses.length ? ORDERS.filter((item) => statuses.includes(item.status)) : ORDERS;
      return json(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 10 });
    }
    return json(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return listRequests;
};

/** Ro'yxatdagi buyurtma qatori (mijoz nomi bo'yicha) ichidagi holat belgisi. */
const badgeOf = (page: Page, customer: string) =>
  page.getByRole("row").filter({ hasText: customer }).locator("[data-order-status]");

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ ro'yxat: «Marketga topshirildi», «Mijoz kutilmoqda» — «Yangi» emas; noma'lum holat neytral", async ({ page }) => {
  await mockOrders(page);
  await page.goto("/orders");
  await expect(page.getByText("Mijoz 1001").first()).toBeVisible({ timeout: 90_000 });

  await expect(badgeOf(page, "Mijoz 1001")).toHaveText("Marketga topshirildi");
  await expect(badgeOf(page, "Mijoz 1001")).toHaveAttribute("data-order-status", "returned_to_market");
  await expect(badgeOf(page, "Mijoz 1002")).toHaveText("Mijoz kutilmoqda");
  await expect(badgeOf(page, "Mijoz 1002")).toHaveAttribute("data-order-status", "waiting_customer");
  await expect(badgeOf(page, "Mijoz 1003")).toHaveText("Lost in transit");
  await expect(badgeOf(page, "Mijoz 1003")).toHaveAttribute("data-order-status", "unknown");
  await expect(badgeOf(page, "Mijoz 1004")).toHaveText("Yangi");
  // Ton (`TONE_SOFT`): neytral va ogohlantirish — «Yangi» (info) rangida emas.
  await expect(badgeOf(page, "Mijoz 1001")).toHaveClass(/\bbg-sunken\b/);
  await expect(badgeOf(page, "Mijoz 1002")).toHaveClass(/\bbg-warning-soft\b/);
  await expect(badgeOf(page, "Mijoz 1003")).toHaveClass(/\bbg-sunken\b/);
  await expect(badgeOf(page, "Mijoz 1004")).toHaveClass(/\bbg-info-soft\b/);
});

test("⭐ «Holat» filtrida ikkala variant bor; ?status=returned_to_market backend'ga uzatiladi va faqat o'shalar chiqadi", async ({ page }) => {
  const listRequests = await mockOrders(page);
  await page.goto("/orders?status=returned_to_market");
  await expect(page.getByText("Mijoz 1001").first()).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => listRequests.at(-1)?.get("status")).toBe("returned_to_market");
  await expect(page.getByText("Mijoz 1002")).toHaveCount(0);
  await expect(page.getByText("Mijoz 1004")).toHaveCount(0);

  // Faol holat filtri bor — panel ochiq turadi («Filtrlar 1»); yopiq bo'lsa ochiladi.
  const toggle = page.getByRole("button", { name: /^Filtrlar( \d+)?$/ });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.getByText("Holat: Marketga topshirildi")).toBeVisible();
  // Tanlangan qiymat chipi (×) maydon o'rtasini egallaydi — ro'yxat klaviatura bilan ochiladi.
  const select = page.getByRole("combobox", { name: "Holat" });
  await select.focus();
  await select.press("Enter");
  const listbox = page.getByRole("listbox");
  await expect(listbox.getByRole("option", { name: "Mijoz kutilmoqda" })).toBeVisible();
  await expect(listbox.getByRole("option", { name: "Marketga topshirildi" })).toBeVisible();
  await expect(listbox.getByRole("option", { name: "Marketga topshirildi" })).toHaveAttribute("aria-selected", "true");
});
