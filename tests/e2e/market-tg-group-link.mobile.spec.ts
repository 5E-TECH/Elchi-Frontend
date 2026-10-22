import { expect, test } from "@playwright/test";
import { TG_GROUP_DEEP_LINK, mockMarketTgGroupApi } from "./support/marketTgGroup";

/**
 * TG-B — telefon (390px): market tafsilotidagi «Telegram guruhi» kartasi (`*-users-detail-telegram` telefon
 * ko'rinishi: «Ulash» to'liq enli, ≥ 44px), havola oynasi pastki varaqa (telefon qadamlari, yig'ilgan «Boshqa
 * telefondan — QR kod»), market profili va `/all-users` kartalarida «Bot ulangan / ulanmagan». Gorizontal skroll yo'q.
 */
const noHorizontalScroll = async (page: import("@playwright/test").Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe("Market Telegram guruhi (TG-B) — telefon 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin: karta, to'liq enli «Ulash» → pastki varaqa, qadamlar, yig'ilgan QR, 44px", async ({ page }) => {
    await mockMarketTgGroupApi(page, { role: "superadmin" });
    await page.goto("/all-users/201");

    const card = page.getByRole("region", { name: "Telegram guruhi" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    const link = card.getByRole("button", { name: "Bekor qilinganlar guruhini ulash" });
    await link.scrollIntoViewIfNeeded();
    const linkBox = await link.boundingBox();
    const cardBox = await card.boundingBox();
    expect(linkBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((linkBox?.width ?? 0) / (cardBox?.width ?? 1)).toBeGreaterThan(0.8);
    const pii = card.getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" });
    expect((await pii.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const allGroups = card.getByRole("link", { name: /Barcha guruhlar/ });
    expect((await allGroups.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await noHorizontalScroll(page);

    await link.click();
    const dialog = page.getByRole("dialog", { name: "Telegram guruhini ulash" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("«Telegram'da ochish» ni bosing")).toBeVisible();
    await expect(dialog.getByText("Guruh ulanishi kutilmoqda…")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", TG_GROUP_DEEP_LINK);
    // Pastki varaqa: oyna ekran pastiga yopishgan.
    await expect
      .poll(async () => {
        const sheet = await dialog.boundingBox();
        return Math.round((sheet?.y ?? 0) + (sheet?.height ?? 0));
      })
      .toBe(844);

    const toggle = dialog.getByRole("button", { name: "Boshqa telefondan — QR kod" });
    await expect(dialog.getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" })).toHaveCount(0);
    await toggle.click();
    await expect(dialog.getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" })).toBeVisible();
    for (const control of [toggle, dialog.getByRole("link", { name: "Telegram'da ochish" }), dialog.getByRole("button", { name: "Yopish" }).last()]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await noHorizontalScroll(page);
  });

  test("⭐ market /profile: «Telegram guruhi» kartasi, ikkala «Ulash» ≥ 44px, gorizontal skroll yo'q", async ({ page }) => {
    await mockMarketTgGroupApi(page, { role: "market" });
    await page.goto("/profile");

    const groups = page.getByRole("region", { name: "Telegram guruhi" });
    await expect(groups).toBeVisible({ timeout: 90_000 });
    for (const name of ["Yangi buyurtmalar guruhini ulash", "Bekor qilinganlar guruhini ulash"]) {
      const button = groups.getByRole("button", { name });
      await button.scrollIntoViewIfNeeded();
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await noHorizontalScroll(page);
  });

  test("⭐ /all-users kartalari: «Bot ulangan» / «Bot ulanmagan»", async ({ page }) => {
    await mockMarketTgGroupApi(page, { role: "superadmin" });
    await page.goto("/all-users");

    await expect(page.getByText("Bot ulangan")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Bot ulanmagan")).toBeVisible();
    await noHorizontalScroll(page);
  });
});
