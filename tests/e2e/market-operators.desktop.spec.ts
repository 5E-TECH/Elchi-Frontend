import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openMarketOperators } from "./support/marketOperators";
import { toast } from "./support/toast";

/**
 * MO-1 — `/market-operators` (market, 1440): yon menyuda «Operatorlar» (faol), jadval ustunlari va komissiya matni,
 * «Komissiya belgilanmagan» ogohlantirishi va «Faqat ularni ko'rsatish», qo'shish (POST faqat 3 maydon → PATCH
 * komissiya), Komissiya oynasi (chegara xatosi → saqlash), o'chirish tasdig'i. Gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ yon menyuda «Operatorlar», jadval, ogohlantirish va «Faqat ularni ko'rsatish»", async ({ page }) => {
  const mock = await openMarketOperators(page);

  const nav = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Mahsulotlar" }) }).first();
  await expect(nav.getByRole("link", { name: "Operatorlar" })).toHaveAttribute("aria-current", "page");

  const table = page.getByRole("table", { name: "Operatorlar ro'yxati" });
  await expect(table.getByRole("columnheader")).toHaveText([
    "Operator",
    "Telefon",
    "Komissiya",
    "Holat",
    "Ombordagi qoldiq",
    "Qo'shilgan",
    "Amallar",
  ]);
  await expect(table.getByRole("row", { name: /Madina Xoliqova/ })).toContainText("5%");
  await expect(table.getByRole("row", { name: /Sevara Usmonova/ })).toContainText("3 000 so'm");
  await expect(table.getByRole("row", { name: /Kamola Rasulova/ })).toContainText("Tizimga kira olmaydi");
  await expect(page.getByText("5 ta operator")).toBeVisible();

  await expect(page.getByText("2 ta operatorda komissiya belgilanmagan — daromad yozilmaydi")).toBeVisible();
  await page.getByRole("button", { name: "Faqat ularni ko'rsatish" }).click();
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.getByRole("button", { name: "Hammasini ko'rsatish" }).click();
  await expect(table.getByRole("row")).toHaveCount(6);

  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
});

test("⭐ operator qo'shish: POST {name, phone_number, password} → PATCH komissiya → «Operator qo'shildi»", async ({ page }) => {
  const mock = await openMarketOperators(page);

  await page.getByRole("button", { name: "Operator qo'shish" }).click();
  const dialog = page.getByRole("dialog", { name: "Operator qo'shish" });
  await expect(dialog).toContainText("Baraka Shop uchun yangi xodim");
  await dialog.getByLabel("Ism familiya").fill("Lola Karimova");
  await dialog.getByLabel("Telefon").fill("901234567");
  await dialog.locator("input[type=password]").fill("lola2026ok");
  await dialog.getByRole("textbox", { name: /Komissiya/ }).fill("4,5");
  await dialog.getByRole("button", { name: "Qo'shish" }).click();

  await expect(toast(page, "Operator qo'shildi", { tone: "success" })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(mock.posts).toEqual([{ name: "Lola Karimova", phone_number: "+998901234567", password: "lola2026ok" }]);
  expect(mock.patches).toEqual([{ id: "47", body: { commission_type: "percent", commission_value: 4.5 } }]);
  await expect(page.getByRole("row", { name: /Lola Karimova/ })).toContainText("4,5%");
});

test("Komissiya oynasi: qat'iy summa chegarasi → xato, to'g'ri qiymat → PATCH; o'chirish tasdig'i → DELETE", async ({ page }) => {
  const mock = await openMarketOperators(page);

  await page.getByRole("button", { name: "Sevara Usmonova amallari" }).click();
  await page.getByRole("menuitem", { name: "Komissiyani o'zgartirish" }).click();
  const dialog = page.getByRole("dialog", { name: "Komissiya" });
  await expect(dialog).toContainText("3 000 so'm · qat'iy");
  const amount = dialog.getByRole("textbox", { name: /Summa/ });
  await amount.fill("1 500 000");
  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await expect(dialog.getByText("Qat'iy komissiya 1 000 000 so'mdan oshmasin")).toBeVisible();
  expect(mock.patches).toEqual([]);
  await amount.fill("5000");
  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await expect(toast(page, "Komissiya saqlandi", { tone: "success" })).toBeVisible();
  expect(mock.patches).toEqual([{ id: "42", body: { commission_type: "fixed", commission_value: 5000 } }]);

  await page.getByRole("button", { name: "Kamola Rasulova amallari" }).click();
  await page.getByRole("menuitem", { name: "O'chirish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Operatorni o'chirish" });
  await expect(confirm).toContainText("Komissiya: 3,5%");
  await confirm.getByRole("button", { name: "O'chirish" }).click();
  await expect(toast(page, "Operator o'chirildi", { tone: "success" })).toBeVisible();
  expect(mock.deletes).toEqual(["43"]);
  await expect(page.getByRole("row", { name: /Kamola Rasulova/ })).toHaveCount(0);
});

test("⭐ XtcEyQjb: «Ombordagi qoldiqni ko'radi» — PATCH :id/warehouse-access, javobdan keyin yoqilgan + xabar", async ({ page }) => {
  const mock = await openMarketOperators(page);
  const toggle = page.getByRole("switch", { name: "Madina Xoliqova — ombordagi qoldiqni ko'radi" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toast(page, "Ombordagi qoldiq ochildi", { tone: "success" })).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(mock.patches).toEqual([{ id: "41", body: { can_view_warehouse_stock: true } }]);
  expect(mock.leaked).toEqual([]);
});
