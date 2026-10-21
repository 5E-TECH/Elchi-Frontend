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
  // CS-C: market yorliqlari — «Uyga / Markazga standart narx» (maket `superadmin-users-detail`).
  await expect(tariff.locator("dt", { hasText: "Uyga standart narx" }).locator("xpath=following-sibling::dd[1]")).toHaveText(
    /^35\s?000\s?so'm$/,
  );
  await expect(
    tariff.locator("dt", { hasText: "Markazga standart narx" }).locator("xpath=following-sibling::dd[1]"),
  ).toHaveText(/^25\s?000\s?so'm$/);
  await expect(tariff.getByText("Uyga tarif")).toHaveCount(0);
  await expect(tariff).toContainText(/250\s?so'm/);

  await content.getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: /^Market nomi/ })).toHaveValue("Baraka Shop");
  const ai = dialog.getByRole("textbox", { name: "AI narxi (1 buyurtma)" });
  await expect(ai).toHaveValue("250");
  await expect(ai).toHaveAccessibleDescription("Shu market uchun · 0 — bepul");

  // Maket to'ri `minmax(min(240px,100%),1fr)`: 1440 va 768 da 2×2 — «Markazga standart narx» va «AI narxi» bir
  // qatorda, «AI narxi» o'ngda va «Uyga standart narx» bilan bir ustunda (3 + 1 emas). Yorliqlar — CS-C.
  const center = dialog.getByRole("textbox", { name: /^Markazga standart narx/ });
  const home = dialog.getByRole("textbox", { name: /^Uyga standart narx/ });
  await expect(home).toHaveValue(/^35\s?000$/);
  await expect(center).toHaveValue(/^25\s?000$/);
  for (const width of [1440, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const [a, c, h] = await Promise.all([ai.boundingBox(), center.boundingBox(), home.boundingBox()]);
        return [Math.round((a?.y ?? 0) - (c?.y ?? -99)), (a?.x ?? 0) > (c?.x ?? 0), Math.round((a?.x ?? 0) - (h?.x ?? -99))];
      }, { message: `${width}px: 2×2 to'r` })
      .toEqual([0, true, 0]);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await ai.fill("");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ ai_price_per_order: null });
  await expect(dialog).toBeHidden();
  await expect(tariff.getByText("AI narxi (1 buyurtma)")).toHaveCount(0);
  await expect(tariff).not.toContainText("300");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
