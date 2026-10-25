import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoLeakRequests,
  expectOnlyOperatorOrderLinks,
  openOperatorEarnings,
  openOperatorHome,
} from "./support/marketOperatorHome";

/**
 * MO-2 — market operatori (desktop): bosh sahifa — o'z marketi KPI va reytingi («Siz» — profildagi `market_id`), xarajat
 * tasdiqlarisiz; «Daromadim» — «Stavkam» (foiz) va menyudan o'tish. MO-3: yon menyu to'liq (Bosh sahifa · Buyurtmalar ·
 * Buyurtma yaratish · Mahsulotlar · Daromadim), bosh sahifada «Buyurtma yaratish» va buyurtma havolalari.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ yon menyu va bosh sahifa: o'z marketi «Siz», xarajat tasdiqlari yo'q, buyurtma havolalari faqat ochiq yo'llarga", async ({
  page,
}) => {
  const mock = await openOperatorHome(page);

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link")).toHaveText(["Bosh sahifa", "Buyurtmalar", "Buyurtma yaratish", "Mahsulotlar", "Daromadim"]);

  const sales = page.getByRole("list", { name: "Marketlar bo'yicha sotuv foizi" });
  await expect(sales.getByRole("listitem").filter({ hasText: "Baraka Shop" })).toContainText("Siz");
  await expect(sales.getByRole("listitem").filter({ hasText: "Nur Elektronika" })).not.toContainText("Siz");
  await expect(page.getByText("Qo'shimcha xarajat tasdiqlari")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buyurtma yaratish" })).toBeVisible();
  await expectOnlyOperatorOrderLinks(page);
  await expectNoHorizontalOverflow(page);
  expectNoLeakRequests(mock);

  await nav.getByRole("link", { name: "Daromadim" }).click();
  await expect(page).toHaveURL(/\/my-earnings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Daromadim" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Daromadim" })).toHaveAttribute("aria-current", "page");
});

test("«Daromadim» — foiz stavkasi: qiymat, turi, belgilovchi, namuna; Taklif bloklari yo'q", async ({ page }) => {
  const mock = await openOperatorEarnings(page);

  const card = page.getByRole("region", { name: "Stavkam" });
  await expect(card.getByTestId("operator-rate-value")).toHaveText("5%");
  await expect(card).toContainText("har sotilgan buyurtma narxidan");
  await expect(card).toContainText("Foiz");
  await expect(card).toContainText("250 000 so'm → 12 500 so'm");
  await expect(page.getByText("Komissiya belgilanmagan — daromad yozilmaydi")).toHaveCount(0);
  for (const title of ["Hisob", "To'lovlar", "Daromadlar"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(page);
  expectNoLeakRequests(mock, { home: false });
});

test("«Daromadim» — boshqa rolga 403 (market egasi o'z operatorlarini «Operatorlar» da ko'radi)", async ({ page }) => {
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4194") return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    const headers = {
      "access-control-allow-origin": "http://127.0.0.1:4194",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = url.pathname.replace(/^\//, "");
    const body =
      path === "auth/my-profile"
        ? { statusCode: 200, data: { id: "5", role: "market", name: "Baraka Shop", status: "active" } }
        : { statusCode: 200, data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } };
    return route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  await page.goto("/my-earnings");
  await expect(page.getByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("link", { name: "Daromadim" })).toHaveCount(0);
});
