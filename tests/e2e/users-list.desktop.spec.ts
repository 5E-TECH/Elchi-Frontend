import { expect, test } from "@playwright/test";
import { openUsers } from "./support/usersList";

/** 84IDGRDp — `/all-users` keng ekranda gorizontal oqib ketish yo'q (390 — `users-list.mobile.spec.ts`). */
test.describe.configure({ timeout: 180_000 });

for (const width of [1440, 1920]) {
  test(`⭐ ${width}px: gorizontal oqib ketish yo'q`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openUsers(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  });
}
