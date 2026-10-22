import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * qNwXfqLL — buyurtma yaratish katalogi («Mahsulot qo'shish»): 10 tadan ko'p mahsulot ko'rinadi, qidiruv serverga
 * `?search=` bilan ketadi (300 ms kechikish, har harfda emas), topilmasa «Topilmadi»; mahsulotsiz market ham
 * «Topilmadi», izohda katalog bo'shligi va qayerdan qo'shish (D-19).
 * Superadmin (`/product/market/:id`) va market (`/product/my-products`). Soxta backend server sukutini (`limit`
 * siz — 10 ta) va server qidiruvini taqlid qiladi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

/** 12 ta mahsulot; 11-si — «Eski choynak» (server sukuti 10 bo'lsa ro'yxatga tushmaydi). */
const CATALOG = Array.from({ length: 12 }, (_, index) => ({
  id: `p${index + 1}`,
  name: index === 10 ? "Eski choynak" : `Mahsulot ${index + 1}`,
  price: 10_000 * (index + 1),
}));
const MARKETS = [
  { id: 3, name: "Baraka Shop", phone_number: "+998903152241", status: "active" },
  { id: 4, name: "Bo'sh market", phone_number: "+998936041872", status: "active" },
];

type Role = "superadmin" | "market";
const PROFILES: Record<Role, Record<string, unknown>> = {
  superadmin: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
  market: { id: "3", role: "market", name: "Baraka Shop", status: "active", add_order: true },
};

const mockApi = async (page: Page, role: Role, { empty = false } = {}) => {
  const productRequests: string[] = [];
  const leaked: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "auth/my-profile") return reply(route, wrap(PROFILES[role]));
    if (path === "orders/ai-availability") return reply(route, wrap({ enabled: false, state: "disabled" }));
    if (path === "markets") return reply(route, wrap(MARKETS));
    const market = path.match(/^product\/market\/(\d+)$/);
    if (market || path === "product/my-products") {
      productRequests.push(`${path}${url.search}`);
      // Server: `limit` siz — 10 ta (catalog-service sukuti), `search` — nom bo'yicha.
      const owned = empty || market?.[1] === "4" ? [] : CATALOG;
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const found = owned.filter((product) => product.name.toLowerCase().includes(search));
      return reply(route, { data: found.slice(0, limit), total: found.length, page: 1, limit });
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { productRequests, leaked };
};

/** Superadmin: 1-qadamda market tanlanadi → «Keyingi». Market roli to'g'ridan-to'g'ri 2-qadamda. */
const openCatalog = async (page: Page, role: Role, marketName = "Baraka Shop") => {
  await page.goto("/new-orders/create");
  if (role === "superadmin") {
    await page.getByRole("button", { name: /^Market/ }).click({ timeout: 60_000 });
    const dialog = page.getByRole("dialog", { name: "Market tanlash" });
    await dialog.getByRole("option", { name: new RegExp(marketName) }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Keyingi" }).click();
  }
  const catalog = page.getByRole("list", { name: `${marketName} katalogi` });
  await expect(catalog).toBeVisible({ timeout: 60_000 });
  return catalog;
};

const searchCatalog = async (page: Page, text: string) => {
  const input = page.getByRole("searchbox", { name: "Mahsulot qo'shish" });
  await input.fill("");
  await input.pressSequentially(text, { delay: 40 });
};

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

for (const role of ["superadmin", "market"] as const) {
  const endpoint = role === "market" ? "product/my-products" : "product/market/3";

  test(`⭐ ${role}: 10 tadan ko'p mahsulot, 11-si qidiruvda serverdan (?search=), topilmasa «Topilmadi»`, async ({ page }) => {
    const api = await mockApi(page, role);
    const catalog = await openCatalog(page, role);

    // To'liq katalog — `limit=500` (server sukuti 10 emas): 12 ta ham ro'yxatda.
    await expect(catalog.getByRole("button")).toHaveCount(12);
    await expect(catalog.getByRole("button", { name: /Eski choynak/ })).toBeVisible();
    expect(api.productRequests).toContain(`${endpoint}?limit=500`);

    // Qidiruv — serverda, oxirgi harfdan 300 ms keyin bitta so'rov (har harfda emas).
    const before = api.productRequests.length;
    await searchCatalog(page, "choynak");
    await expect(catalog.getByRole("button")).toHaveCount(1);
    await expect(catalog.getByRole("button", { name: /Eski choynak/ })).toBeVisible();
    expect(api.productRequests.slice(before)).toEqual([`${endpoint}?search=choynak&limit=500`]);

    await searchCatalog(page, "yo'q narsa");
    await expect(catalog.getByText("Topilmadi", { exact: true })).toBeVisible();
    expect(api.productRequests.at(-1)).toBe(`${endpoint}?search=yo%27q+narsa&limit=500`);

    // Tozalansa — darhol to'liq katalog (keshdan, yangi so'rovsiz).
    const cleared = api.productRequests.length;
    await page.getByRole("searchbox", { name: "Mahsulot qo'shish" }).fill("");
    await expect(catalog.getByRole("button")).toHaveCount(12);
    expect(api.productRequests.length).toBe(cleared);
    expect(api.leaked).toEqual([]);
  });

  test(`⭐ ${role}: mahsulotsiz market — «Topilmadi» + katalog bo'sh izohi (D-19), qidiruvda ham`, async ({ page }) => {
    const api = await mockApi(page, role, { empty: true });
    const catalog = await openCatalog(page, role, role === "market" ? "Baraka Shop" : "Bo'sh market");
    const hint = "Bu marketning katalogi bo'sh. Mahsulotni «Katalogda yo'q mahsulot» maydoni orqali qo'shing.";
    await expect(catalog.getByText("Topilmadi", { exact: true })).toBeVisible();
    await expect(catalog.getByText(hint)).toBeVisible();
    await searchCatalog(page, "choynak");
    await expect.poll(() => api.productRequests.some((request) => request.includes("search=choynak"))).toBe(true);
    await expect(catalog.getByText("Topilmadi", { exact: true })).toBeVisible();
    await expect(catalog.getByRole("button")).toHaveCount(0);
    expect(api.leaked).toEqual([]);
  });
}
