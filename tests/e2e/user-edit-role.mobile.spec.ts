import { expect, test } from "@playwright/test";
import { tapTargets, tooSmall } from "./support/tapTargets";
import { toast } from "./support/toast";
import { openEditDialog, openStaffDetail } from "./support/userEditRole";

/**
 * FY-2 (telefon 390): «Rol» bo'limi pastki varaqada, ro'yxat qatorlari ≥ 44 px, tasdiq ham pastki varaqa;
 * 503 → oyna ichida «Qayta urinish» (tasdiqsiz qayta yuboradi). Gorizontal oqib ketish va kichik nishon yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: Admin → Ro'yxatchi, 503 dan keyin «Qayta urinish»", async ({ page }) => {
  const { rolePatches } = await openStaffDetail(page, { roleStatuses: [503] });
  const dialog = await openEditDialog(page);

  const field = dialog.getByRole("combobox", { name: "Rol" });
  expect(Math.round((await field.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
  await field.click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(4);
  for (const box of await Promise.all((await options.all()).map((option) => option.boundingBox()))) {
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  }
  await options.nth(2).click();
  await expect(field).toHaveAccessibleDescription("O'zgartirildi: Admin → Ro'yxatchi · saqlashda tasdiq so'raladi");

  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
  await expect(confirm).toBeVisible();
  // Pastki varaqa: oyna ekranning pastiga yopishgan.
  const sheet = await confirm.boundingBox();
  expect(Math.round((sheet?.y ?? 0) + (sheet?.height ?? 0))).toBeGreaterThanOrEqual(page.viewportSize()!.height - 2);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await confirm.getByRole("button", { name: "Rolni o'zgartirish" }).click();

  const alert = dialog.getByTestId("role-change-error");
  await expect(alert).toContainText("Hozir tekshirib bo'lmadi — rol o'zgarmadi.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(tooSmall(await tapTargets(page))).toEqual([]);

  await alert.getByRole("button", { name: "Qayta urinish" }).click();
  await expect.poll(() => rolePatches).toEqual([{ role: "registrator" }, { role: "registrator" }]);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(dialog).toBeHidden();
  await expect(toast(page, "Rol o'zgartirildi")).toBeVisible();
});
