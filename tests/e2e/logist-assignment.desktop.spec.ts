import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  mockLogistApi,
  openLogistAssignment,
  regionsCard,
} from "./support/logistAssignment";
import { toast } from "./support/toast";

/**
 * LG-2 — `/regions/logist-assignment` (superadmin, 1440): logistlar ro'yxati, 6 karta holati, «N ta o'zgarish»,
 * olib tashlash / o'tkazish — tasdiq oynasi → POST region/logist/bulk, faqat qo'shish — darhol; saqlanmagan
 * o'zgarish bilan boshqa logist — «O'zgarishlar saqlanmaydi»; nofaol logist; «Logist» yaratish → shu sahifa
 * yangi logist tanlangan holda. Gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ o'tkazish va olib tashlash — tasdiq oynasi, POST bulk, «Saqlandi», ro'yxat yangilanadi", async ({
  page,
}) => {
  const mock = await mockLogistApi(page);
  await openLogistAssignment(page);

  const list = page.getByRole("group", { name: "Logistlar ro'yxati" });
  await expect(list.getByRole("button")).toHaveCount(4);
  await expect(list.getByRole("button", { name: /^Aziz Rahimov/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(list.getByRole("button", { name: /^Aziz Rahimov/ })).toContainText("4 viloyat");
  await expect(list.getByRole("button", { name: /^Sherzod Nazarov/ })).toContainText("Viloyatsiz");
  await expect(list.getByRole("button", { name: /^Malika Yusupova/ })).toContainText("Nofaol");

  const card = regionsCard(page);
  await expect(card.getByText("+998 90 123 45 67 · 14 tadan 4 tasi belgilangan")).toBeVisible();
  await expect(card.getByRole("checkbox")).toHaveCount(14);
  await expect(card.getByRole("button", { name: "Saqlash" })).toBeDisabled();

  await card.getByRole("checkbox", { name: /^Buxoro/ }).check();
  await card.getByRole("checkbox", { name: /^Jizzax/ }).check();
  await card.getByRole("checkbox", { name: /^Surxondaryo/ }).uncheck();
  await expect(card.getByRole("checkbox", { name: /^Jizzax/ })).toHaveAccessibleName(
    "Jizzax Hozir: Dilnoza Karimova O'tkaziladi",
  );
  await expect(card.getByText("3 ta o'zgarish")).toBeVisible();
  await expect(
    card.getByText("1 ta qo'shiladi · 1 ta o'tkaziladi · 1 ta olib tashlanadi"),
  ).toBeVisible();
  // Telefondagi yopishqoq panel desktopda ko'rinmaydi.
  await expect(page.getByRole("region", { name: "Saqlanmagan o'zgarishlar" })).toBeHidden();
  await expectNoHorizontalOverflow(page);

  await card.getByRole("button", { name: "Saqlash" }).click();
  const dialog = page.getByRole("alertdialog", { name: "O'zgarishlarni saqlaysizmi?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("list", { name: "O'zgarishlar" }).getByRole("listitem")).toHaveText(
    [
      /Surxondaryo.*Viloyat logistsiz qoladi.*Olib tashlanadi/,
      /Jizzax.*Dilnoza Karimovadan olinadi.*O'tkaziladi/,
      /Buxoro.*Hozir logist yo'q.*Qo'shiladi/,
    ],
  );
  await dialog.getByRole("button", { name: "Saqlash" }).click();

  await expect(toast(page, "Saqlandi", { tone: "success" })).toBeVisible();
  await expect(toast(page, "Aziz Rahimov · 5 ta viloyat")).toBeVisible();
  expect(mock.bulks).toEqual([{ logist_id: "41", region_ids: ["4", "6", "8", "9", "11"] }]);
  await expect(list.getByRole("button", { name: /^Aziz Rahimov/ })).toContainText("5 viloyat");
  await expect(list.getByRole("button", { name: /^Dilnoza Karimova/ })).toContainText("2 viloyat");
  await expect(card.getByText("O'zgarish yo'q")).toBeVisible();
  expect(mock.leaked).toEqual([]);
});

test("saqlanmagan o'zgarish bilan boshqa logist, nofaol logist; faqat qo'shish — darhol saqlanadi", async ({
  page,
}) => {
  const mock = await mockLogistApi(page);
  await openLogistAssignment(page);
  const list = page.getByRole("group", { name: "Logistlar ro'yxati" });
  const card = regionsCard(page);

  await card.getByRole("checkbox", { name: /^Xorazm/ }).check();
  await list.getByRole("button", { name: /^Malika Yusupova/ }).click();
  const leave = page.getByRole("alertdialog", { name: "O'zgarishlar saqlanmaydi" });
  await expect(leave).toContainText(
    "Aziz Rahimov uchun 1 ta o'zgarish saqlanmagan. Malika Yusupovaga o'tsangiz, ular bekor bo'ladi.",
  );
  await leave.getByRole("button", { name: "O'zgarishsiz o'tish" }).click();
  await expect(page).toHaveURL(/\?logist=44$/);
  await expect(page.getByText("Malika Yusupova nofaol")).toBeVisible();
  await expect(card.getByRole("checkbox", { name: /^Xorazm/ })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Saqlash" })).toBeDisabled();

  await list.getByRole("button", { name: /^Sherzod Nazarov/ }).click();
  await expect(page.getByRole("heading", { name: "Sherzod Nazarov viloyatlari" })).toBeVisible();
  await card.getByRole("checkbox", { name: /^Xorazm/ }).check();
  await card.getByRole("button", { name: "Saqlash" }).click();
  await expect(toast(page, "Sherzod Nazarov · 1 ta viloyat")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(mock.bulks).toEqual([{ logist_id: "43", region_ids: ["14"] }]);
});

test("«Logist yaratish» → «Logist» roli → POST /logists → shu sahifa yangi logist tanlangan holda", async ({
  page,
}) => {
  const mock = await mockLogistApi(page);
  await openLogistAssignment(page);

  await page.getByRole("link", { name: "Logist yaratish" }).click();
  await expect(page).toHaveURL(/\/all-users\/create-user\?role=logist$/);
  await expect(page.getByRole("radio", { name: /^Logist/ })).toBeChecked();
  const form = page.getByRole("form", { name: "Logist qo'shish" });
  await expect(form).toContainText(
    "Logist o'ziga biriktirilgan viloyatlar statistikasini kuzatadi",
  );
  await form.locator('input[name="fullName"]').fill("Lola Karimova");
  await form.locator('input[name="phone"]').fill("901112233");
  await form.locator('input[name="password"]').fill("lola2026");
  await form.locator('input[name="salary"]').fill("6000000");
  await form.getByRole("button", { name: "Saqlash" }).click();

  await expect(toast(page, "Logist yaratildi", { tone: "success" })).toBeVisible();
  await expect(page).toHaveURL(/\/regions\/logist-assignment\?logist=57$/);
  await expect(page.getByRole("heading", { name: "Lola Karimova viloyatlari" })).toBeVisible();
  expect(mock.creates).toEqual([
    { name: "Lola Karimova", phone_number: "+998901112233", password: "lola2026", salary: 6000000 },
  ]);
  expect(mock.leaked).toEqual([]);
});

test("logist yo'q — «Logist yo'q» va «Logist yaratish»", async ({ page }) => {
  await mockLogistApi(page, { logists: [] });
  await page.goto("/regions/logist-assignment");
  await expect(page.getByText("Logist yo'q", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "Logist yaratish" })).toHaveAttribute(
    "href",
    "/all-users/create-user?role=logist",
  );
});
