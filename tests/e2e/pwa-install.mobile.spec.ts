import { expect, test } from "@playwright/test";
import {
  IPHONE_UA,
  expectNoHorizontalOverflow,
  expectTapTargets,
  setupPwaSession,
  shot,
} from "./support/pwaInstall";

/**
 * KI-2 «Ilovani o'rnatish» (PWA) — 390 px. Maketlar: courier-inbox-pwa-install, courier-inbox-pwa-ios-dialog
 * (pastki varaqa), courier-dashboard-pwa-install, common-settings-notifications-pwa.
 */
test.describe("Ilovani o'rnatish — 390px (Android)", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`kuryer bosh sahifasi (${theme}): karta, «O'rnatish» + yopish ≥ 44 px, toshish yo'q`, async ({ page }) => {
      await setupPwaSession(page, { theme });
      await page.goto("/");
      const card = page.getByTestId("pwa-install-card-dashboard");
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(card).toContainText("Bosh ekrandan bir bosishda ochiladi.");
      await expectTapTargets(page, "[data-testid=pwa-install-card-dashboard]");
      await expectNoHorizontalOverflow(page);
      await shot(page, `dashboard-courier-phone-${theme}`);
    });
  }

  test("/inbox: karta telefon izohi bilan, toshish yo'q", async ({ page }) => {
    await setupPwaSession(page);
    await page.goto("/inbox");
    const card = page.getByTestId("pwa-install-card-inbox");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText("Bosh ekrandan bir bosishda, alohida oynada ochiladi.");
    await expectTapTargets(page, "[data-testid=pwa-install-card-inbox]");
    await expectNoHorizontalOverflow(page);
    await shot(page, "inbox-installable-phone-light");
  });

  test("Sozlamalar → Bildirishnomalar: «Ilova» kartasi, toshish yo'q", async ({ page }) => {
    await setupPwaSession(page, { theme: "dark" });
    await page.goto("/settings");
    await page.getByRole("main").getByRole("tab", { name: /^Bildirishnomalar/ }).click({ timeout: 60_000 });
    const status = page.getByTestId("pwa-install-status");
    await expect(status).toHaveAttribute("data-status", "installable");
    await status.scrollIntoViewIfNeeded();
    await expectTapTargets(page, "[data-testid=pwa-install-status]");
    await expectNoHorizontalOverflow(page);
    await shot(page, "settings-installable-phone-dark");
  });
});

test.describe("Ilovani o'rnatish — 390px (iPhone)", () => {
  test.use({ userAgent: IPHONE_UA });
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`/inbox (${theme}): «Qanday qo'shiladi» → «Bosh ekranga qo'shing» pastki varaqasi, 3 qadam`, async ({ page }) => {
      const { leaked } = await setupPwaSession(page, { mode: "ios", theme });
      await page.goto("/inbox");
      const card = page.getByTestId("pwa-install-card-inbox");
      await expect(card.getByRole("heading", { name: "Elchi'ni bosh ekranga qo'shing" })).toBeVisible({ timeout: 60_000 });
      await card.getByRole("button", { name: "Qanday qo'shiladi" }).click();
      const dialog = page.getByRole("dialog", { name: "Bosh ekranga qo'shing" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("list", { name: "Qo'shish qadamlari" }).getByRole("listitem")).toHaveCount(3);
      await expect(dialog).toContainText("Faqat Safari'da ishlaydi.");
      // Telefonda pastki varaqa: pastki chetga yopishgan.
      const box = await dialog.boundingBox();
      expect(box && Math.round(box.y + box.height)).toBeGreaterThanOrEqual(840);
      await expectNoHorizontalOverflow(page);
      await page.waitForTimeout(400);
      await shot(page, `inbox-ios-dialog-phone-${theme}`);
      await dialog.getByRole("button", { name: "Tushunarli" }).click();
      await expect(dialog).toBeHidden();
      expect(leaked).toEqual([]);
    });
  }

  test("Sozlamalar: iOS holati — «Qanday qo'shiladi»", async ({ page }) => {
    await setupPwaSession(page, { mode: "ios" });
    await page.goto("/settings");
    await page.getByRole("main").getByRole("tab", { name: /^Bildirishnomalar/ }).click({ timeout: 60_000 });
    const status = page.getByTestId("pwa-install-status");
    await expect(status).toHaveAttribute("data-status", "ios");
    await expect(status).toContainText("iPhone va iPad'da Safari orqali bosh ekranga qo'shiladi");
    await status.getByRole("button", { name: "Qanday qo'shiladi" }).click();
    await expect(page.getByRole("dialog", { name: "Bosh ekranga qo'shing" })).toBeVisible();
  });
});
