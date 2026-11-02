import { expect, test } from "@playwright/test";
import { mockHundredOrders, orderRef } from "./support/ordersVirtual";

/**
 * F4RSPBwx, FCdwcvEv — filtr o'zgarganda «Sahifadagi qatorlar soni» saqlanadi (avval 100 → 10 ga tushardi) va bitta
 * bosish bitta so'rov: ortiqcha navigatsiya butun daraxtni ikkinchi marta chizardi, `limit=10` bilan ortiqcha so'rov
 * ketardi. Soxta backend, 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

test("⭐ limit=100: holat tabi bosilsa limit saqlanadi, so'rov bitta", async ({ page }) => {
  const { requests } = await mockHundredOrders(page);
  await page.goto("/orders?limit=100");
  const first = page.getByRole("table").getByRole("link", { name: `№${orderRef(1)}` });
  await expect(first).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const before = requests.length;

  await page
    .getByRole("tab", { name: /^Yangi/ })
    .first()
    .click();
  await expect(page).toHaveURL(/status=new/);
  await expect.poll(() => requests.length).toBe(before + 1);
  await page.waitForTimeout(400);
  expect(requests.length).toBe(before + 1);
  expect(requests.at(-1)?.get("limit")).toBe("100");
  expect(page.url()).toContain("limit=100");
});

test("⭐ 2-sahifadan filtr o'zgarsa — 1-sahifa, limit saqlanadi", async ({ page }) => {
  const { requests } = await mockHundredOrders(page);
  await page.goto("/orders?limit=25&page=2");
  await expect(page.getByRole("tab", { name: /^Yangi/ }).first()).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => requests.at(-1)?.get("page")).toBe("2");

  await page
    .getByRole("tab", { name: /^Yangi/ })
    .first()
    .click();
  await expect(page).toHaveURL(/status=new/);
  await expect.poll(() => requests.at(-1)?.get("page")).toBe("1");
  expect(requests.at(-1)?.get("limit")).toBe("25");
  expect(page.url()).toContain("limit=25");
});
