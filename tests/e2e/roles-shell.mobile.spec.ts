import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * ROL-0 — yangi rollar qobig'i va market pastki menyusi (390px, telefon).
 *
 *  - market (ega MO-S1): pastki menyu Bosh sahifa · Buyurtmalar · Yaratish · To'lovlar · Menyu; «Mahsulotlar» —
 *    «Menyu» varaqasida (maket `market-dashboard-mobile-menu`).
 *  - Yangi rollar o'z spec'larida: logist — LG-1 (`logist-home.*.spec.ts`), investor — IN-1
 *    (`investor-home.*.spec.ts`), market operatori — MO-2 (`market-operator-home.*.spec.ts`, sizish to'sig'i bilan).
 *
 * API — `route.fulfill` bilan soxta; yozish so'rovlari taqiqlangan.
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

const setup = async (page: Page, role: string, name: string) => {
  const leaked: string[] = [];
  const requested: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    requested.push(path);
    if (path === "auth/my-profile") return reply(route, wrap({ id: "42", role, name, status: "active" }));
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });

  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, requested };
};

const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Asosiy bo'limlar" });

test("market: pastki menyu — Bosh sahifa · Buyurtmalar · Yaratish · To'lovlar · Menyu; Mahsulotlar — Menyu ichida", async ({
  page,
}) => {
  const { leaked } = await setup(page, "market", "Baraka Shop");
  await page.goto("/settings");

  const nav = bottomNav(page);
  await expect(nav).toBeVisible();
  const cells = nav.locator(":scope > a, :scope > button");
  await expect(cells).toHaveText(["Bosh sahifa", "Buyurtmalar", "Yaratish", "To'lovlar", "Menyu"]);
  await expect(nav.getByRole("link", { name: "To'lovlar" })).toHaveAttribute("href", "/cash-box");
  await expect(nav.getByRole("link", { name: "Mahsulotlar" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Skaner/ })).toHaveCount(0);

  // Kataklar teng va ≥ 44px.
  const boxes = await cells.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    }),
  );
  for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
  expect(new Set(boxes.map((box) => box.width)).size).toBe(1);

  await nav.getByRole("button", { name: "Menyu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menyu" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("href", "/products");
  await expect(sheet.getByRole("searchbox", { name: "Qidiruv" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(leaked).toEqual([]);
});
