import { expect, type Page, type Route } from "@playwright/test";

/**
 * iR4B6hcP — /orders filtri brauzer «Orqaga» dan keyin: «Filtrlar N» soni, faol filtr chiplari va ro'yxat bir-biriga
 * mos. Yo'l o'zgarganda Redux filtri tozalanadi (`useResetInputsOnPathChange`), /orders filtrlarining manbai esa URL —
 * qaytilganda hammasi URL'dan tiklanadi. Soxta API (superadmin): `where_deliver=center` — faqat markazgacha buyurtma.
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

const createdAt = new Date().toISOString();
const order = (id: number, name: string, whereDeliver: "center" | "address") => ({
  id,
  status: "waiting",
  where_deliver: whereDeliver,
  total_price: 150000,
  createdAt,
  customer: { id: `c${id}`, name, phone_number: "+998901112233" },
  market: { id: "m1", name: "Baraka Shop" },
  district: { id: "d1", name: "Chilonzor" },
});

export const CENTER_CUSTOMER = "Dilnoza Karimova";
export const HOME_CUSTOMER = "Sardor Aliyev";
const ORDERS = [order(7101, CENTER_CUSTOMER, "center"), order(7102, HOME_CUSTOMER, "address")];

export const mockOrdersFilterBack = async (page: Page) => {
  const listQueries: URLSearchParams[] = [];
  const leaked: string[] = [];
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
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "orders") {
      listQueries.push(url.searchParams);
      const where = url.searchParams.get("where_deliver");
      const items = where ? ORDERS.filter((item) => item.where_deliver === where) : ORDERS;
      return reply(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 25 });
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
  return { listQueries, leaked };
};

/** «Filtrlar N» soni, «Yetkazish turi: Markazgacha» chipi va faqat markazgacha buyurtma — uchalasi mos. */
export const expectCenterFilterApplied = async (page: Page, listQueries: URLSearchParams[]) => {
  await expect(page).toHaveURL(/[?&]where_deliver=center\b/);
  await expect(page.getByRole("button", { name: /^Filtrlar\s*1\b/ })).toBeVisible();
  await expect(page.getByText("Yetkazish turi: Markazgacha", { exact: true })).toBeVisible();
  await expect(page.getByText(CENTER_CUSTOMER).first()).toBeVisible();
  await expect(page.getByText(HOME_CUSTOMER)).toHaveCount(0);
  await expect.poll(() => listQueries.at(-1)?.get("where_deliver")).toBe("center");
};

/** Ilova ichida boshqa bo'limga o'tish (yon menyu / pastki menyu havolasi) — sahifa qayta yuklanmaydi. */
export const leaveOrders = async (page: Page, link: ReturnType<Page["getByRole"]>) => {
  await link.click();
  await expect(page).not.toHaveURL(/\/orders/);
  await expect(page.getByText(CENTER_CUSTOMER)).toHaveCount(0);
};
