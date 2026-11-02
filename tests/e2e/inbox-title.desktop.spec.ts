import { expect, test } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/**
 * 17HWafL7 — `/inbox` sarlavhasi: superadminda «Bildirishnomalar qutisi» (maket `superadmin-notifications-inbox`,
 * menyudagi «Bildirishnomalar» — Telegram guruhlari), boshqa rollarda «Bildirishnomalar» (`common-inbox`).
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

const CASES = [
  { role: "superadmin", title: "Bildirishnomalar qutisi" },
  { role: "admin", title: "Bildirishnomalar" },
  { role: "market", title: "Bildirishnomalar" },
  { role: "courier", title: "Bildirishnomalar" },
];

for (const { role, title } of CASES) {
  test(`⭐ ${role}: sarlavha «${title}»`, async ({ page }) => {
    const { leaked } = await setupShellSession(page, role, "Sinov");
    await page.goto("/inbox");
    const heading = page
      .locator("[data-shell-slot=content]")
      .getByRole("heading", { level: 1, name: title, exact: true });
    await expect(heading).toBeVisible({ timeout: 60_000 });
    expect(leaked).toEqual([]);
  });
}
