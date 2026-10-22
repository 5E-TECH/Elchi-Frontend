import { expect, test } from "@playwright/test";
import { tapTargets, tooSmall } from "./support/tapTargets";
import { openMarketDetail } from "./support/userEditMarketAi";

/**
 * FY-1 (maket `superadmin-users-edit-market-ai-phone`): 390px — tahrirlash oynasi pastki varaqa, «AI narxi»
 * maydoni ko'rinadi va 0 (bepul) saqlanadi; gorizontal oqib ketish va kichik nishon yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390 market: «AI narxi» maydoni pastki varaqada, 0 — bepul saqlanadi", async ({ page }) => {
  const { content, patches } = await openMarketDetail(page);

  await content.getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await expect(dialog).toBeVisible();
  const ai = dialog.getByRole("textbox", { name: "AI narxi (1 buyurtma)" });
  await ai.scrollIntoViewIfNeeded();
  await expect(ai).toBeVisible();
  const box = await ai.boundingBox();
  expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  // Maket (telefon): bitta ustun — «AI narxi» «Markazga tarif» ostida, chap qirralari bir xil, izoh bir qatorda.
  const center = await dialog.getByRole("textbox", { name: /^Markazga tarif/ }).boundingBox();
  expect(Math.round((box?.y ?? 0) - (center?.y ?? 0))).toBeGreaterThan(40);
  expect(Math.round((box?.x ?? 0) - (center?.x ?? -99))).toBe(0);
  const hint = await dialog.getByText("Shu market uchun · 0 — bepul").boundingBox();
  expect(Math.round(hint?.height ?? 99)).toBeLessThan(24);
  // Pastki varaqa: oyna ekranning pastiga yopishgan.
  const sheet = await dialog.boundingBox();
  expect(Math.round((sheet?.y ?? 0) + (sheet?.height ?? 0))).toBeGreaterThanOrEqual(page.viewportSize()!.height - 2);

  await ai.fill("0");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ ai_price_per_order: 0 });
  await expect(dialog).toBeHidden();
  const aiRow = content.getByRole("region", { name: "Tarif" }).locator("dt", { hasText: "AI narxi (1 buyurtma)" });
  await expect(aiRow.locator("xpath=following-sibling::dd[1]")).toHaveText(/^0\s?so'm$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
});
