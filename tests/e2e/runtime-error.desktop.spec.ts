import { expect, test, type Page } from "@playwright/test";
import { mockDegradedDashboard } from "./support/dashboardDegraded";

/**
 * L6q4DiGU + QKCeGZ3N — sahifa doimiy sabab bilan yiqiladi (`/orders` sahifa moduli o'rniga render paytida xato
 * tashlaydigan modul, dev server, soxta backend). QKCeGZ3N dan beri xato SHELL ICHIDA (taxta `tizim-errors` 01):
 * yon menyu va yuqori panel joyida, manzil o'zgarmaydi, `/runtime-error` ga ham, to'liq qayta yuklash ham yo'q.
 *   - 1-yiqilish — «Qayta urinish» (asosiy) bor, u sahifani qayta chizadi (hujjat so'ralmaydi);
 *   - 2- va keyingilari — takroriy: «Qayta urinish» yo'q, «Bosh sahifaga qaytish» asosiy (cheksiz halqa yo'q);
 *   - «Bosh sahifaga qaytish» — `/`, bosh sahifa odatdagidek ishlaydi, xato yozuvi tozalanadi.
 */
const ORDERS_MODULE = /\/src\/pages\/orders\/index\.tsx/;
const CRASH = 'export default function Crash() { throw new TypeError("r.forEach is not a function"); }';

const crashOrdersPage = async (page: Page) => {
  await mockDegradedDashboard(page);
  await page.route(ORDERS_MODULE, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: CRASH }));
  // Qaysi sahifalar to'liq yuklandi (hujjat so'rovi) — SPA qayta chizish hujjat so'ramaydi.
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document" && request.frame() === page.mainFrame()) {
      documents.push(new URL(request.url()).pathname);
    }
  });
  return documents;
};

const errorPage = (page: Page) => page.locator("[data-error-kind]");
const retryButton = (page: Page) => errorPage(page).getByRole("button", { name: "Qayta urinish" });
const homeButton = (page: Page) => errorPage(page).getByRole("button", { name: "Bosh sahifaga qaytish" });

/** Xato shell ichida: manzil o'zgarmagan, yon menyu va yuqori panel ko'rinadi, xato kontent slotida. */
const expectErrorInShell = async (page: Page, path = "/orders") => {
  await expect(page.locator('[data-shell-slot="content"]').getByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" })).toBeVisible({ timeout: 90_000 });
  await expect(page).toHaveURL((url) => url.pathname === path);
  await expect(page.locator('[data-shell-slot="sidebar"]')).toBeVisible();
  await expect(page.locator('[data-shell-slot="topbar"]')).toBeVisible();
};

const expectRepeated = async (page: Page) => {
  await expectErrorInShell(page);
  await expect(errorPage(page)).toContainText("Bu sahifa takroran xato bermoqda. Administratorga murojaat qiling.");
  await expect(retryButton(page)).toHaveCount(0);
  await expect(homeButton(page)).toHaveAttribute("data-variant", "primary");
  await expect(errorPage(page).getByRole("button", { name: "Orqaga" })).toHaveAttribute("data-variant", "secondary");
};

test.describe("Sahifa xatosi shell ichida, takroriy yiqilishda cheksiz halqa yo'q (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });

  test("⭐ bir xil xato 3 marta: menyu joyida; 1-safar «Qayta urinish» (qayta chizish), 2- va 3-safar — yo'q", async ({ page }) => {
    const documents = await crashOrdersPage(page);

    await page.goto("/orders");
    await expectErrorInShell(page);
    await expect(retryButton(page)).toHaveAttribute("data-variant", "primary");
    await expect(homeButton(page)).toHaveAttribute("data-variant", "secondary");

    // 2-yiqilish: «Qayta urinish» — sahifa qayta chiziladi (hujjat so'ralmaydi) → yana xato.
    await retryButton(page).click();
    await expectRepeated(page);

    // 3-yiqilish: foydalanuvchi sahifani yana ochdi (to'liq yuklash).
    await page.goto("/orders");
    await expectRepeated(page);
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("elchi_runtime_error") ?? "{}").retryCount)).toBe(3);

    // `/runtime-error` hech qachon yuklanmadi — faqat foydalanuvchi o'zi ochgan ikki /orders.
    expect(documents).toEqual(["/orders", "/orders"]);
  });

  test("⭐ «Bosh sahifaga qaytish» — / ga, bosh sahifa odatdagidek ishlaydi, xato yozuvi tozalanadi", async ({ page }) => {
    await crashOrdersPage(page);
    await page.goto("/orders");
    await expectErrorInShell(page);

    await homeButton(page).click();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByTestId("ranking-markets")).toContainText("Baraka Shop", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Sahifani ko'rsatib bo'lmadi" })).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem("elchi_runtime_error"))).toBeNull();
  });
});
