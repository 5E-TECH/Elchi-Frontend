import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * 3qDsJpfW — market o'z mahsulotlarida sahifa va qidiruv; yaratish sahifasida «mavjud mahsulotlar» to'liq.
 * Kontrakt: FRONTEND_CHANGELOG 2026-10-14 (Guruh E): `GET /product/my-products` va `GET /product/market/:id`
 * `search` / `page` / `limit` (≤ 500) qabul qiladi, javob `{ data, total, page, limit }`, sukut limit 10.
 * Soxta backend serverdek: parametr bermasa — 10 ta. 1440px.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const product = (n: number, marketId: string) => ({
  id: String(100 + n),
  name: `Mahsulot ${String(n).padStart(2, "0")}`,
  image_url: null,
  user_id: marketId,
  market: { id: marketId, name: marketId === "7" ? "Baraka Shop" : "Nur Savdo", phone_number: "+998901234567", status: "active" },
  createdAt: "2026-10-01T09:00:00.000Z",
});

const page = (items: unknown[], params: URLSearchParams) => {
  const search = (params.get("search") ?? "").toLowerCase();
  const filtered = search ? items.filter((item) => (item as { name: string }).name.toLowerCase().includes(search)) : items;
  const limit = Math.min(500, Number(params.get("limit")) || 10);
  const current = Number(params.get("page")) || 1;
  return { statusCode: 200, data: filtered.slice((current - 1) * limit, current * limit), total: filtered.length, page: current, limit };
};

const mockApi = async (p: Page, role: "market" | "superadmin") => {
  const requests: URLSearchParams[] = [];
  const marketItems = Array.from({ length: 14 }, (_, i) => product(i + 1, "7"));
  const otherItems = Array.from({ length: 15 }, (_, i) => product(i + 1, "3"));
  await p.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: role === "market" ? "7" : "1", role, name: role === "market" ? "Baraka Shop" : "E2E", status: "active", add_order: true } });
    }
    if (path === "product/my-products") {
      requests.push(url.searchParams);
      return reply(route, page(marketItems, url.searchParams));
    }
    if (path === "product/market/3") {
      requests.push(url.searchParams);
      return reply(route, page(otherItems, url.searchParams));
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await p.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { requests };
};

test.describe("Market mahsulotlari: sahifa va qidiruv (3qDsJpfW) — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC1: 14 mahsulotli market — 2-sahifaga o'tganda `my-products?page=2` ketadi va 11–14 keladi", async ({ page: p }) => {
    const { requests } = await mockApi(p, "market");
    await p.goto("/products");

    await expect(p.getByText("Mahsulot 01", { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(p.getByText("Mahsulot 11", { exact: true })).toHaveCount(0);
    expect(requests.at(-1)?.get("page")).toBe("1");
    expect(requests.at(-1)?.get("limit")).toBe("10");

    await p.getByRole("button", { name: "2", exact: true }).click();

    await expect.poll(() => requests.at(-1)?.get("page")).toBe("2");
    await expect(p.getByText("Mahsulot 11", { exact: true })).toBeVisible();
    await expect(p.getByText("Mahsulot 14", { exact: true })).toBeVisible();
    await expect(p.getByText("Mahsulot 01", { exact: true })).toHaveCount(0);
  });

  test("⭐ TC2: 2-sahifadagi mahsulot nomi qidirilsa — `search` serverga ketadi va natija chiqadi", async ({ page: p }) => {
    const { requests } = await mockApi(p, "market");
    await p.goto("/products");
    await expect(p.getByText("Mahsulot 01", { exact: true })).toBeVisible({ timeout: 90_000 });

    // Dizayn v2 `/products` (maket `market-products-list`): qidiruv maydoni — `searchbox`, nomi locale'dan.
    await p.getByRole("searchbox", { name: "Mahsulotlarni nomi bo'yicha qidirish" }).fill("Mahsulot 13");

    await expect.poll(() => requests.at(-1)?.get("search")).toBe("Mahsulot 13");
    expect(requests.at(-1)?.get("page")).toBe("1");
    await expect(p.getByText("Mahsulot 13", { exact: true })).toBeVisible();
    await expect(p.getByText("Mahsulot 01", { exact: true })).toHaveCount(0);
  });

  test("⭐ TC4: yaratish sahifasi — 15 mahsulotli market (superadmin) jadvalida 15 tasi, `limit` bilan bitta so'rov", async ({ page: p }) => {
    const { requests } = await mockApi(p, "superadmin");
    await p.goto("/products/create-product/3");

    await expect(p.getByText("Mahsulot 15", { exact: true })).toBeVisible({ timeout: 90_000 });
    for (const n of [1, 10, 11, 15]) {
      await expect(p.getByText(`Mahsulot ${String(n).padStart(2, "0")}`, { exact: true })).toBeVisible();
    }
    expect(requests.at(-1)?.get("limit")).toBe("500");
  });

  test("yaratish sahifasi — market rolida o'z 14 mahsulotining hammasi (`my-products?limit=500`)", async ({ page: p }) => {
    const { requests } = await mockApi(p, "market");
    await p.goto("/products/create-product/7");

    await expect(p.getByText("Mahsulot 14", { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(p.getByText("Mahsulot 11", { exact: true })).toBeVisible();
    expect(requests.at(-1)?.get("limit")).toBe("500");
  });
});
