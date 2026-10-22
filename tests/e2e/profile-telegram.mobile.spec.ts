import { expect, test } from "@playwright/test";
import { TG_DEEP_LINK, mockProfileTelegramApi } from "./support/profileTelegram";

/**
 * TG-A (ysBqD9Nx) — /profile «Telegram» havola oynasi telefonda (390px, maket `common-profile-telegram-link-dialog`
 * telefon ko'rinishi): pastki varaqa, sanoq, telefon qadamlari, yig'ilgan «Boshqa telefondan — QR kod»;
 * muddati tugasa — «Havola eskirdi» va «Yangi havola olish». Bosish maydonlari ≥ 44px, gorizontal skroll yo'q.
 */
test.describe("Profil — shaxsiy Telegram (telefon 390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ telefon: qadamlar, yig'ilgan QR, 44px va gorizontal skroll yo'q", async ({ page }) => {
    await mockProfileTelegramApi(page);
    await page.goto("/profile");

    const card = page.getByRole("region", { name: "Telegram" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await card.getByRole("button", { name: "Telegram'ni ulash" }).click();

    const dialog = page.getByRole("dialog", { name: "Telegram'ni ulash" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("«Telegram'da ochish» ni bosing")).toBeVisible();
    await expect(dialog.getByText("Shu sahifaga qayting — u o'zi yangilanadi")).toBeVisible();
    await expect(dialog.getByRole("timer")).toHaveText(/qoldi$/);
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", TG_DEEP_LINK);

    const toggle = dialog.getByRole("button", { name: "Boshqa telefondan — QR kod" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(dialog.getByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" })).toHaveCount(0);
    const box = await toggle.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" })).toBeVisible();

    for (const control of [
      dialog.getByRole("link", { name: "Telegram'da ochish" }),
      dialog.getByRole("button", { name: "Yopish" }).last(),
    ]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("⭐ muddati tugadi: «Havola eskirdi», «Yangi havola olish» yangi kod so'raydi", async ({ page }) => {
    const state = await mockProfileTelegramApi(page, { expiresInMs: 3_000 });
    await page.goto("/profile");

    const card = page.getByRole("region", { name: "Telegram" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await card.getByRole("button", { name: "Telegram'ni ulash" }).click();

    const dialog = page.getByRole("dialog", { name: "Telegram'ni ulash" });
    await expect(dialog.getByText("Havola eskirdi")).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByText("Havola 10 daqiqa amal qiladi va bir marta ishlatiladi. Ulash uchun yangisini oling."),
    ).toBeVisible();
    await expect(dialog.getByText("Ulanish kutilmoqda…")).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Yangi havola olish" }).click();
    await expect(dialog.getByRole("timer")).toBeVisible();
    expect(state.codeRequests).toBe(2);
  });
});
