import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * MJAKYdyh — /orders saralash sarlavhasi klaviaturadan: Tab bilan «Buyurtma» (sana bo'yicha) sarlavha tugmasiga
 * yetiladi, fokus halqasi ko'rinadi (tizim-motion: 2 px `--color-action`), Enter bosilganda saralash yo'nalishi
 * almashadi — URL, `GET /orders` paramlari (`sort_by`, `sort_dir`), `aria-sort` va qatorlar tartibi. 1440px,
 * kunduzgi va tungi.
 */
/** Ilova manzili (`E2E_ORIGIN` — boshqa portda yurgizish uchun, sukut `playwright.config.ts` dagi 4173). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

/** №1001 … №1005: id kattasi — yangisi (`createdAt` bir soatdan farq qiladi). */
const ORDERS = Array.from({ length: 5 }, (_, i) => ({
  id: String(1001 + i),
  status: "new",
  total_price: 150000,
  createdAt: new Date(Date.UTC(2026, 9, 20, 6 + i)).toISOString(),
  customer: { name: `Mijoz ${1001 + i}`, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Chilonzor", region: { id: "1", name: "Toshkent" } },
  items: [],
}));

/** Soxta backend: `sort_dir` bo'yicha sana tartibi (sukut — eng yangisi tepada). */
const mockOrders = async (page: Page, theme: "light" | "dark") => {
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
      return json(route, {
        statusCode: 200,
        data: {
          id: "1",
          role: "superadmin",
          name: "Bosh admin",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "orders") {
      listRequests.push(url.searchParams);
      const ascending = url.searchParams.get("sort_dir") === "asc";
      const items = ascending ? ORDERS : [...ORDERS].reverse();
      return json(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 10 });
    }
    return json(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((sessionTheme) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", sessionTheme);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  return listRequests;
};

/** Jadvaldagi mijozlar tartibi (sarlavha qatorisiz). */
const customerOrder = (page: Page) =>
  page.locator("table tbody tr").evaluateAll((rows) =>
    rows.map((row) => row.textContent?.match(/Mijoz \d+/)?.[0]).filter(Boolean),
  );

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ ${theme}: Tab bilan «Buyurtma» saralash tugmasi, fokus halqasi; Enter — sana bo'yicha tartib almashadi`, async ({ page }, testInfo) => {
    const requests = await mockOrders(page, theme);
    await page.goto("/orders");
    await expect(page.getByText("Mijoz 1005").first()).toBeVisible({ timeout: 90_000 });
    if (theme === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    const header = page.getByRole("columnheader", { name: "Buyurtma" });
    const sortButton = header.getByRole("button", { name: "Buyurtma" });
    // Sukut — eng yangisi tepada.
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(header).toHaveAttribute("scope", "col");
    expect(await customerOrder(page)).toEqual(["Mijoz 1005", "Mijoz 1004", "Mijoz 1003", "Mijoz 1002", "Mijoz 1001"]);

    // Faqat klaviatura: sahifa boshidan Tab bilan sarlavha tugmasigacha.
    let reached = false;
    for (let step = 0; step < 80 && !reached; step += 1) {
      await page.keyboard.press("Tab");
      reached = await sortButton.evaluate((button) => button === document.activeElement);
    }
    expect(reached, "Tab bilan «Buyurtma» saralash tugmasiga yetib bo'lmadi").toBe(true);
    const ring = await sortButton.evaluate((button) => {
      const style = getComputedStyle(button);
      return { style: style.outlineStyle, width: style.outlineWidth, visible: button.matches(":focus-visible") };
    });
    expect(ring).toEqual({ style: "solid", width: "2px", visible: true });
    await testInfo.attach(`orders-sort-focus-${theme}`, { body: await header.screenshot(), contentType: "image/png" });

    await page.keyboard.press("Enter");
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(page).toHaveURL(/orderSortBy=createdAt/);
    await expect(page).toHaveURL(/orderSortDir=asc/);
    await expect.poll(() => requests.at(-1)?.get("sort_dir")).toBe("asc");
    expect(requests.at(-1)?.get("sort_by")).toBe("created_at");
    await expect.poll(() => customerOrder(page)).toEqual(["Mijoz 1001", "Mijoz 1002", "Mijoz 1003", "Mijoz 1004", "Mijoz 1005"]);
    // Fokus tugmada qoladi — yana Enter teskari tartibga qaytaradi.
    await expect(sortButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect.poll(() => customerOrder(page)).toEqual(["Mijoz 1005", "Mijoz 1004", "Mijoz 1003", "Mijoz 1002", "Mijoz 1001"]);
  });
}
