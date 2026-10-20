import { expect, test } from "@playwright/test";
import { openMarketDetail } from "./support/userEditMarketAi";

/**
 * FY-1 (maket `superadmin-users-edit-market-ai`): «Tarif» kartasida «AI narxi (1 buyurtma)» qatori; tahrirlash
 * oynasida «Market nomi *» va «AI narxi» (izoh «Shu market uchun · 0 — bepul»); maydon tozalansa — `null`
 * (global narx), keyin qator yo'qoladi va sukut narx (300) hech qayerda ko'rsatilmaydi (FY-S5). Telefon —
 * `user-edit-market-ai.mobile.spec.ts`.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ market: «AI narxi» tafsilotda va tahrirda; tozalansa `ai_price_per_order: null`, qator yo'qoladi", async ({ page }) => {
  const { content, patches } = await openMarketDetail(page);

  const tariff = content.getByRole("region", { name: "Tarif" });
  await expect(tariff.getByText("AI narxi (1 buyurtma)")).toBeVisible();
  await expect(tariff).toContainText(/250\s?so'm/);

  await content.getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: /^Market nomi/ })).toHaveValue("Baraka Shop");
  const ai = dialog.getByRole("textbox", { name: "AI narxi (1 buyurtma)" });
  await expect(ai).toHaveValue("250");
  await expect(ai).toHaveAccessibleDescription("Shu market uchun · 0 — bepul");

  await ai.fill("");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ ai_price_per_order: null });
  await expect(dialog).toBeHidden();
  await expect(tariff.getByText("AI narxi (1 buyurtma)")).toHaveCount(0);
  await expect(tariff).not.toContainText("300");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
