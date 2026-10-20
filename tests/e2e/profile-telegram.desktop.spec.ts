import { expect, test } from "@playwright/test";
import { TG_DEEP_LINK, mockProfileTelegramApi } from "./support/profileTelegram";
import { toast } from "./support/toast";

/**
 * TG-A (ysBqD9Nx) — /profile «Telegram» kartasi va havola oynalari (maketlar `common-profile-telegram*`), 1440px:
 * QR oq ramkada, teskari sanoq + progress, «Ulanish kutilmoqda…», bot ulagach oyna yopilib «Telegram ulandi»,
 * ulangan holatda qalin «@username» · sana; muddat tugashi va yangi havola; buyruq rejimi (faqat «Yopish»); uzish — tasdiq bilan.
 */
test.describe("Profil — shaxsiy Telegram (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ havola oynasi: QR, sanoq va progress; bot ulagach oyna yopiladi, karta «Ulangan»", async ({ page }) => {
    const state = await mockProfileTelegramApi(page, { linkAfterPolls: 1 });
    await page.goto("/profile");

    const card = page.getByRole("region", { name: "Telegram" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await expect(card.getByText("Ulanmagan")).toBeVisible();

    await card.getByRole("button", { name: "Telegram'ni ulash" }).click();
    const dialog = page.getByRole("dialog", { name: "Telegram'ni ulash" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" })).toBeVisible();
    await expect(dialog.getByRole("timer")).toHaveText(/^(10:00|9:5\d) qoldi$/);
    await expect(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "600");
    await expect(dialog.getByText("Ulanish kutilmoqda…")).toBeVisible();
    await expect(dialog.getByRole("list", { name: "Qanday ulanadi" }).getByRole("listitem")).toHaveCount(3);
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", TG_DEEP_LINK);
    await expect(dialog.getByRole("button", { name: "Boshqa telefondan — QR kod" })).toHaveCount(0);

    // Profil har 3 s qayta o'qiladi — bot ulagach oyna o'zi yopiladi.
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(toast(page, "Telegram ulandi")).toBeVisible();
    await expect(card.getByText("Ulangan", { exact: true })).toBeVisible();
    await expect(card.getByText("@ali_kuryer")).toBeVisible();
    await expect(card.getByText("12.10.2026 da ulangan")).toBeVisible();
    expect(state.codeRequests).toBe(1);
  });

  test("⭐ muddat tugadi: «Havola eskirdi», «Yangi havola olish» yangi kod so'raydi va sanoq qaytadi", async ({ page }) => {
    // Birinchi kod 3 s da eskiradi, ikkinchisi — odatdagi 10 daqiqa.
    const state = await mockProfileTelegramApi(page, { expiresInMs: (n) => (n === 1 ? 3_000 : 10 * 60_000) });
    await page.goto("/profile");

    const card = page.getByRole("region", { name: "Telegram" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await card.getByRole("button", { name: "Telegram'ni ulash" }).click();

    const dialog = page.getByRole("dialog", { name: "Telegram'ni ulash" });
    await expect(dialog.getByRole("timer")).toBeVisible();
    await expect(dialog.getByText("Havola eskirdi")).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByText("Havola 10 daqiqa amal qiladi va bir marta ishlatiladi. Ulash uchun yangisini oling."),
    ).toBeVisible();
    await expect(dialog.getByRole("timer")).toHaveCount(0);
    await expect(dialog.getByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveCount(0);
    expect(state.codeRequests).toBe(1);

    await dialog.getByRole("button", { name: "Yangi havola olish" }).click();
    await expect(dialog.getByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" })).toBeVisible();
    await expect(dialog.getByRole("timer")).toHaveText(/^(10:00|9:5\d) qoldi$/);
    await expect(dialog.getByText("Havola eskirdi")).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", TG_DEEP_LINK);
    expect(state.codeRequests).toBe(2);
  });

  test("⭐ buyruq rejimi (deep_link yo'q): buyruq va o'z qadamlari, sanoqsiz, faqat «Yopish»", async ({ page }) => {
    await mockProfileTelegramApi(page, { deepLink: null });
    await page.goto("/profile");

    const card = page.getByRole("region", { name: "Telegram" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await card.getByRole("button", { name: "Telegram'ni ulash" }).click();

    const dialog = page.getByRole("dialog", { name: "Telegram'ni ulash" });
    await expect(dialog.getByText("/start Kod123")).toBeVisible();
    await expect(dialog.getByText("Buyruqni nusxalang")).toBeVisible();
    await expect(dialog.getByText("Uni Elchi botiga shaxsiy xabar qilib yuboring")).toBeVisible();
    await expect(dialog.getByRole("timer")).toHaveCount(0);
    await expect(dialog.getByRole("img")).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveCount(0);
    await expect(dialog.getByText("Ulanish kutilmoqda…")).toBeVisible();

    await dialog.getByRole("button", { name: "Yopish" }).last().click();
    await expect(dialog).toBeHidden();
  });

  test("⭐ uzish: tasdiq oynasi, so'ng DELETE va «Telegram uzildi»", async ({ page }) => {
    const state = await mockProfileTelegramApi(page, { linked: true });
    await page.goto("/profile");

    const card = page.getByRole("region", { name: "Telegram" });
    await expect(card.getByText("@ali_kuryer")).toBeVisible({ timeout: 90_000 });
    await card.getByRole("button", { name: "Uzish" }).click();

    const confirm = page.getByRole("alertdialog", { name: "Telegram'ni uzish" });
    await expect(
      confirm.getByText("Bot xabarlari va tugmalari bu akkauntga endi kelmaydi. Istalgan vaqtda qayta ulashingiz mumkin."),
    ).toBeVisible();
    expect(state.unlinkRequests).toBe(0);
    await confirm.getByRole("button", { name: "Uzish" }).click();

    await expect(toast(page, "Telegram uzildi")).toBeVisible();
    await expect(card.getByText("Ulanmagan")).toBeVisible();
    expect(state.unlinkRequests).toBe(1);
  });
});
