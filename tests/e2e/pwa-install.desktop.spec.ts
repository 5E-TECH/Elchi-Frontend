import { expect, test } from "@playwright/test";
import { promptCount, setupPwaSession, shot } from "./support/pwaInstall";

/**
 * KI-2 «Ilovani o'rnatish» (PWA) — 1440 px. Maketlar: courier-inbox-pwa-install, common-settings-notifications-pwa,
 * courier-dashboard-pwa-install. Ega javobi KI-S3: /inbox — doim; Sozlamalar — doim (4 holat); kuryer bosh sahifasi —
 * bir marta, yopiladi.
 */
test.describe("Ilovani o'rnatish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`/inbox (${theme}): karta «O'rnatish» bilan, yopishsiz; bosilsa brauzer oynasi, o'rnatilgach yo'qoladi`, async ({ page }) => {
      const { leaked } = await setupPwaSession(page, { theme });
      await page.goto("/inbox");
      const card = page.getByTestId("pwa-install-card-inbox");
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(card.getByRole("heading", { name: "Elchi'ni ilova sifatida o'rnating" })).toBeVisible();
      await expect(card).toContainText("Ish stolidan yoki boshlash menyusidan alohida oynada ochiladi.");
      await expect(card.getByRole("button", { name: "Taklifni yopish" })).toHaveCount(0);
      await shot(page, `inbox-installable-desktop-${theme}`);

      await card.getByRole("button", { name: "O'rnatish" }).click();
      await expect.poll(() => promptCount(page)).toBe(1);
      await expect(card).toBeHidden();
      expect(leaked).toEqual([]);
    });
  }

  test("Sozlamalar → Bildirishnomalar: tab izohi «· ilova», «Ilova» kartasi — O'rnatilmagan + «O'rnatish»", async ({ page }) => {
    const { leaked } = await setupPwaSession(page, { role: "superadmin", outcome: "dismissed" });
    await page.goto("/settings");
    const tab = page.getByRole("main").getByRole("tab", { name: /^Bildirishnomalar/ });
    await expect(tab).toContainText("Shu qurilmaga xabarlar · ilova", { timeout: 60_000 });
    await tab.click();
    const card = page.getByTestId("settings-app-install");
    await expect(card.getByRole("heading", { name: "Ilova" })).toBeVisible();
    const status = card.getByTestId("pwa-install-status");
    await expect(status).toHaveAttribute("data-status", "installable");
    await expect(status).toContainText("O'rnatilmagan");
    await shot(page, "settings-installable-desktop-light");
    await status.getByRole("button", { name: "O'rnatish" }).click();
    await expect.poll(() => promptCount(page)).toBe(1);
    // Rad etildi — holat «O'rnatilmagan» qoladi; ikkinchi bosish — brauzer menyusi izohi.
    await status.getByRole("button", { name: "O'rnatish" }).click();
    await expect(page.getByText("Brauzer menyusidan o'rnating", { exact: true })).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("Sozlamalar: o'rnatib bo'lmaydigan brauzer — «Qo'llab-quvvatlanmaydi», tugmasiz; /inbox da karta yo'q", async ({ page }) => {
    await setupPwaSession(page, { role: "superadmin", mode: "unsupported", theme: "dark" });
    await page.goto("/settings");
    await page.getByRole("main").getByRole("tab", { name: /^Bildirishnomalar/ }).click({ timeout: 60_000 });
    const status = page.getByTestId("pwa-install-status");
    await expect(status).toHaveAttribute("data-status", "unsupported");
    await expect(status).toContainText("Qo'llab-quvvatlanmaydi");
    await expect(status.getByRole("button")).toHaveCount(0);
    await shot(page, "settings-unsupported-desktop-dark");

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { level: 1, name: "Bildirishnomalar" })).toBeVisible();
    await expect(page.getByTestId("pwa-install-card-inbox")).toHaveCount(0);
  });

  test("kuryer bosh sahifasi: bir martalik karta, «Taklifni yopish» — qayta ochilganda yo'q, /inbox da qoladi", async ({ page }) => {
    await setupPwaSession(page);
    await page.goto("/");
    const card = page.getByTestId("pwa-install-card-dashboard");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText("Yopsangiz, taklif Sozlamalar va Bildirishnomalarda qoladi.");
    await shot(page, "dashboard-courier-desktop-light");
    await card.getByRole("button", { name: "Taklifni yopish" }).click();
    await expect(card).toBeHidden();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("pwa-install-card-dashboard")).toHaveCount(0);
    await page.goto("/inbox");
    await expect(page.getByTestId("pwa-install-card-inbox")).toBeVisible({ timeout: 60_000 });
  });

  test("admin bosh sahifasi — kartasiz (faqat kuryer)", async ({ page }) => {
    await setupPwaSession(page, { role: "admin" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("pwa-install-card-dashboard")).toHaveCount(0);
  });
});
