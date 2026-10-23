import { expect, test } from "@playwright/test";
import { toast } from "./support/toast";
import { openEditDialog, openStaffDetail, pickRole } from "./support/userEditRole";

/**
 * FY-2 (K3scaE0W, SZTZ4HEU) — superadmin tahrirlash oynasida rolni o'zgartiradi: «Rol» bo'limi (maket
 * `superadmin-users-edit-role`), tasdiq (`superadmin-users-role-confirm-dialog`, `-logist`), 409 oyna ichida
 * (`superadmin-users-edit-role-error`, filial nomisiz). Avval `PATCH users/:id/role`, keyin qolgan maydonlar.
 * Telefon — `user-edit-role.mobile.spec.ts`.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ Admin → Menejer: ro'yxat, tasdiq, `PATCH users/41/role`, tafsilot yangilanadi", async ({ page }) => {
  const { content, rolePatches, userPatches } = await openStaffDetail(page);
  const dialog = await openEditDialog(page);

  const section = dialog.getByRole("region", { name: "Rol" });
  await expect(section).toContainText("Faqat superadmin");
  const field = dialog.getByRole("combobox", { name: "Rol" });
  await expect(field).toHaveText(/Admin/);
  await expect(field).toHaveAccessibleDescription(
    "Faqat admin, menejer, ro'yxatchi va logist o'rtasida almashtiriladi. Saqlashdan oldin tasdiq so'raladi.",
  );

  await field.click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(4);
  await expect(options.nth(1)).toContainText("Filial menejeri: o'z filiali pochtasi, kuryerlari va kassasi");
  await options.nth(1).click();
  await expect(field).toHaveAccessibleDescription("O'zgartirildi: Admin → Menejer · saqlashda tasdiq so'raladi");

  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
  await expect(confirm).toContainText("Nilufar Rashidova endi menejer sifatida ishlaydi.");
  await expect(confirm.getByRole("listitem")).toHaveText([
    "Joriy sessiyasi yopiladi — keyingi kirishda yangi rol bilan ishlaydi",
    "Menejerni filialga biriktiring: «Filiallar» → filial → «Xodim qo'shish»",
    "Eski va yangi rol faoliyat jurnaliga yoziladi",
  ]);
  expect(rolePatches).toEqual([]);

  await confirm.getByRole("button", { name: "Rolni o'zgartirish" }).click();
  await expect.poll(() => rolePatches).toEqual([{ role: "manager" }]);
  await expect(dialog).toBeHidden();
  await expect(toast(page, "Rol o'zgartirildi")).toBeVisible();
  expect(userPatches).toEqual([]);
  // Tafsilot qayta so'raldi — sarlavhadagi rol belgisi yangi.
  await expect(content.getByText("Menejer").first()).toBeVisible();
});

test("409 — oyna ichida «Rol o'zgartirilmadi», backend matni yo'q, qolgan maydonlar yuborilmaydi", async ({ page }) => {
  const { rolePatches, userPatches } = await openStaffDetail(page, {
    user: { name: "Kamron Tursunov", role: "registrator" },
    roleStatuses: [409],
  });
  const dialog = await openEditDialog(page);

  await pickRole(page, "Menejer");
  await dialog.getByRole("textbox", { name: /^Ism familiya/ }).fill("Kamron Tursunov K.");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await page
    .getByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" })
    .getByRole("button", { name: "Rolni o'zgartirish" })
    .click();

  const alert = dialog.getByTestId("role-change-error");
  await expect(alert).toContainText("Rol o'zgartirilmadi");
  await expect(alert).toContainText("Kamron Tursunov filialga biriktirilgan.");
  await expect(page.getByText(/DELETE \/branches/)).toHaveCount(0);
  await expect(dialog.getByRole("combobox", { name: "Rol" })).toHaveAttribute("aria-invalid", "true");
  // Sababi maydon izohida ham (maket: `aria-describedby` → ogohlantirish).
  await expect(dialog.getByRole("combobox", { name: "Rol" })).toHaveAccessibleDescription(/filialga biriktirilgan/);
  await expect(dialog.getByText("O'zgartirildi: Ro'yxatchi → Menejer", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: /^Ism familiya/ })).toHaveValue("Kamron Tursunov K.");
  expect(rolePatches).toEqual([{ role: "manager" }]);
  expect(userPatches).toEqual([]);
});

test("qisman: rol saqlandi, qolgani yo'q — tafsilot qayta kelsa ham kiritilganlar joyida, qayta saqlash yuboradi", async ({
  page,
}) => {
  const { rolePatches, userPatches } = await openStaffDetail(page, { userStatuses: [500] });
  const dialog = await openEditDialog(page);

  await pickRole(page, "Menejer");
  // Menejer tanlansa forma o'zgarmaydi (maket `superadmin-users-role-confirm-dialog`): tarif maydonlari yo'q.
  await expect(dialog.getByRole("textbox", { name: /tarif/i })).toHaveCount(0);
  const nameInput = dialog.getByRole("textbox", { name: /^Ism familiya/ });
  await nameInput.fill("Nilufar Rashidova X");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await page
    .getByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" })
    .getByRole("button", { name: "Rolni o'zgartirish" })
    .click();

  await expect(toast(page, "Rol o'zgartirildi, qolgani saqlanmadi")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Nilufar Rashidova · Menejer");
  await expect(nameInput).toHaveValue("Nilufar Rashidova X");
  expect(rolePatches).toEqual([{ role: "manager" }]);

  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await expect.poll(() => userPatches).toEqual([{ name: "Nilufar Rashidova X" }, { name: "Nilufar Rashidova X" }]);
  await expect(dialog).toBeHidden();
  expect(rolePatches).toEqual([{ role: "manager" }]);
});

test("Logist → Admin: bo'shaydigan viloyatlar va «Logistlarni biriktirish» havolasi", async ({ page }) => {
  const { rolePatches } = await openStaffDetail(page, {
    user: { name: "Aziz Rahimov", role: "logist" },
    regions: [
      { id: 1, name: "Samarqand", logist_id: 41 },
      { id: 2, name: "Navoiy", logist_id: "41" },
      { id: 3, name: "Toshkent", logist_id: 9 },
    ],
  });
  const dialog = await openEditDialog(page);

  await pickRole(page, "Admin");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
  await expect(confirm.getByRole("listitem").first()).toHaveText(
    "2 ta viloyat bo'shatiladi: Samarqand, Navoiy — «Logistlarni biriktirish» sahifasida boshqa logistga beriladi",
  );
  await expect(confirm.getByRole("listitem").last()).toHaveText(
    "Eski va yangi rol, bo'shatilgan viloyatlar faoliyat jurnaliga yoziladi",
  );
  await confirm.getByRole("button", { name: "Rolni o'zgartirish" }).click();

  await expect.poll(() => rolePatches).toEqual([{ role: "admin" }]);
  await toast(page, "Rol o'zgartirildi").getByRole("button", { name: "Logistlarni biriktirish" }).click();
  await expect(page).toHaveURL(/\/regions\/logist-assignment$/);
});
