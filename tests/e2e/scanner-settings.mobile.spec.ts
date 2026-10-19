import { expect, test } from "@playwright/test";
import { cameraDialog, mockNewOrdersCameraApi, openMarket, OWN_TOKEN } from "./support/newOrdersCamera";
import { enterCode, expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";
import { mockSettingsApi, settingsTab } from "./support/settingsNotifications";

/**
 * 390px: Sozlamalar → Skaner → «Kamera» (skaner ishi 4-bosqichi, maket `common-settings-scanner`).
 * Sozlama hisobga yoziladi (`PATCH auth/my-settings` → `scanner.camera`), ilova yuklanganda `SettingsSync` uni
 * qurilmaga ko'chiradi va kamera shundan o'qiydi: «Uzluksiz skanerlash» o'chiq — bitta koddan keyin yopiladi.
 */
test.use(FAKE_CAMERA);

test.describe("Skaner sozlamalari — «Kamera» kartasi, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kalit va ramka tanlovi hisobga saqlanadi", async ({ page }) => {
    const { patches, leaked } = await mockSettingsApi(page, { theme: "light" });
    await page.goto("/settings");
    await settingsTab(page, /^Skaner/).click({ timeout: 60_000 });
    const card = page.getByRole("region", { name: "Kamera" });
    await expect(card.getByRole("link", { name: "Kamerani sinash" })).toHaveAttribute("href", "/scan");

    await card.getByRole("switch", { name: "Uzluksiz skanerlash" }).click();
    await expect(card.getByRole("switch", { name: "Uzluksiz skanerlash" })).toHaveAttribute("aria-checked", "false");
    await card.getByText("Katta", { exact: true }).click();
    await expect(card.getByRole("radio", { name: /^Katta/ })).toBeChecked();

    await expect
      .poll(() => (patches.at(-1) as { scanner?: { camera?: unknown } } | undefined)?.scanner?.camera)
      .toEqual({ facing: "environment", frame: "lg", torchAuto: true, continuous: false });
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });

  test("«Uzluksiz skanerlash» o'chiq — oqim kamerasi bitta qabul qilingan koddan keyin yopiladi", async ({ page }) => {
    const { received } = await mockNewOrdersCameraApi(page, {
      profile: {
        id: "1",
        role: "superadmin",
        name: "Bosh admin",
        status: "active",
        settings: { scanner: { camera: { continuous: false } } },
      },
    });
    await openMarket(page);
    await page.getByRole("link", { name: "Skaner — Qabul qilish" }).click();
    const dialog = cameraDialog(page);
    await expect(dialog).toBeVisible();

    await enterCode(page, dialog, OWN_TOKEN);
    await expect.poll(() => received).toEqual([["10254"]]);
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/new-orders\/121$/);
  });
});
