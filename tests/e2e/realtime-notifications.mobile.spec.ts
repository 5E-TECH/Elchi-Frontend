import { expect, test } from "@playwright/test";
import { mockRealtime } from "./support/realtime";

/** uRkw6lk0 — 390px: jonli xabar tepada (yuqori panel ostida), pastki menyuni yopmaydi, gorizontal skroll yo'q. */
test.describe("Jonli bildirishnomalar — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC9: xabar yuqori panel ostida chiqadi, pastki menyuni yopmaydi", async ({ page }) => {
    const { state, dispatch } = await mockRealtime(page);
    await page.goto("/inbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);

    dispatch({ id: "n-3", title: "Pochta keldi", body: "Pochta №2493 · Samarqand", category: "logistics", link: "/mails/today" });

    const toast = page.getByRole("region", { name: "Bildirishnomalar" }).getByText("Pochta keldi", { exact: true });
    await expect(toast).toBeVisible();
    const toastBox = (await toast.boundingBox())!;
    const header = (await page.locator("header").first().boundingBox())!;
    expect(toastBox.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    const nav = page.getByRole("navigation").last();
    const navBox = (await nav.boundingBox())!;
    expect(toastBox.y + toastBox.height).toBeLessThan(navBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
