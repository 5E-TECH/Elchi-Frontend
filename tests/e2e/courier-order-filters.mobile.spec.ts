import { expect, test } from "@playwright/test";
import { mockCourierFilters } from "./support/courierFilters";

/**
 * yKtzKXeM — 390px: maketda (`courier-orders-pending`) telefonda faqat qidiruv: ekran uzunligini oshirmaydi,
 * maydon ≥ 44px, gorizontal skroll yo'q, qidiruv ishlaydi.
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ faqat qidiruv: joyiga sig'adi va ro'yxatni toraytiradi", async ({ page }) => {
  const { requests, leaked } = await mockCourierFilters(page);
  await page.goto("/orders");
  const search = page.getByRole("searchbox", { name: /Buyurtmalarni ism/ });
  await expect(search).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Jasur Karimov").first()).toBeVisible();

  const box = (await search.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeLessThanOrEqual(56);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(page.getByRole("button", { name: /Sana oralig'i/ })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Yetkazish turi" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await search.fill("Feruza");
  await expect.poll(() => requests.at(-1)?.get("search")).toBe("Feruza");
  await expect(page.getByText("Feruza Mirzayeva").first()).toBeVisible();
  await expect(page.getByText("Jasur Karimov")).toHaveCount(0);
  expect(leaked).toEqual([]);
});
