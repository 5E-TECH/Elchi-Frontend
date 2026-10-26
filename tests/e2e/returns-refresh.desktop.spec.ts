import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * sUjPxTzJ — partiya qabul qilingach /returns ro'yxati qayta so'raladi. /returns partiyalar kesh ildizida
 * (`queryKeys.batches.returns`), qabul (`POST transfer-batches/:id/receive`) esa `[batches]` ni yangilaydi. Avval
 * /returns o'z `["return-batches"]` kalitida edi: qabuldan keyin qaytilganda eski ro'yxat so'rovsiz ko'rinardi.
 * Superadmin, soxta API, sahifalar orasida SPA o'tish (to'liq qayta yuklashsiz), 1440px.
 */
/** Ilova manzili (`E2E_ORIGIN` — boshqa portda yurgizish uchun, sukut `playwright.config.ts` dagi 4194). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const createdAt = new Date().toISOString();
const SENT_BATCH = {
  id: "180",
  qr_code_token: "BTB-180",
  source_branch: { id: "7", name: "Urgut filiali" },
  destination_branch: { id: "1", name: "Toshkent HQ" },
  direction: "FORWARD",
  status: "SENT",
  order_count: 2,
  total_price: 300000,
  createdAt,
};
const RETURN_BATCH = {
  id: "171",
  source_branch: { name: "Urgut filiali" },
  destination_branch: { name: "Toshkent HQ" },
  order_count: 4,
  total_price: 1160000,
  status: "PENDING",
  createdAt,
};

const mockApi = async (page: Page) => {
  const state = { returnsRequests: 0, receives: [] as string[], leaked: [] as string[] };
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (path === "transfer-batches" && request.method() === "GET") {
      const returns = url.searchParams.get("direction") === "RETURN";
      if (returns) state.returnsRequests += 1;
      const items = returns ? [RETURN_BATCH] : state.receives.includes(SENT_BATCH.id) ? [] : [SENT_BATCH];
      return reply(route, { statusCode: 200, data: { items, meta: { page: 1, limit: 100, total: items.length } } });
    }
    if (path === `transfer-batches/${SENT_BATCH.id}/receive` && request.method() === "POST") {
      state.receives.push(SENT_BATCH.id);
      return reply(route, { statusCode: 200, message: "Received" });
    }
    if (path === "branches/7") return reply(route, { statusCode: 200, data: { id: "7", name: "Urgut filiali" } });
    if (request.method() !== "GET") {
      state.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
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
  return state;
};

/** Ilova ichidagi o'tish (React Router) — sahifa qayta yuklanmaydi, so'rov keshi saqlanadi. */
const spaNavigate = (page: Page, path: string) =>
  page.evaluate((to) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ partiya qabul qilingach /returns ga qaytilganda ro'yxat qayta so'raladi", async ({ page }) => {
  const state = await mockApi(page);

  await page.goto("/returns");
  await expect(page.getByText("Urgut filiali").first()).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => state.returnsRequests).toBe(1);

  await spaNavigate(page, "/new-orders/branches/7");
  await page.getByRole("checkbox", { name: /paketini tanlash/ }).first().check({ timeout: 60_000 });
  await page.getByRole("button", { name: /Qabul qilish/ }).click();
  await expect.poll(() => state.receives).toEqual([SENT_BATCH.id]);
  await expect(page.getByRole("checkbox", { name: /paketini tanlash/ })).toHaveCount(0);

  await spaNavigate(page, "/returns");
  await expect(page.getByText("Urgut filiali").first()).toBeVisible();
  // 2 s ichida: ro'yxat eskirgan deb belgilangan — qaytishda qayta so'raladi (avval 30 s gacha eski qolardi).
  await expect.poll(() => state.returnsRequests, { timeout: 2_000 }).toBe(2);
  expect(state.leaked).toEqual([]);
});
