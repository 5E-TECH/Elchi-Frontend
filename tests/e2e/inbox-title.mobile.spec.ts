import { expect, test } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/** 17HWafL7 — 390px: `/inbox` sarlavhasi rol bo'yicha, gorizontal skroll yo'q. */
test.describe.configure({ timeout: 120_000 });

for (const { role, title } of [
  { role: "superadmin", title: "Bildirishnomalar qutisi" },
  { role: "courier", title: "Bildirishnomalar" },
]) {
  test(`⭐ ${role}: sarlavha «${title}»`, async ({ page }) => {
    const { leaked } = await setupShellSession(page, role, "Sinov");
    await page.goto("/inbox");
    const heading = page
      .locator("[data-shell-slot=content]")
      .getByRole("heading", { level: 1, name: title, exact: true });
    await expect(heading).toBeVisible({ timeout: 60_000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(leaked).toEqual([]);
  });
}
