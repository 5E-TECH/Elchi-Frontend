import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openMarketOperators } from "./support/marketOperators";
import { toast } from "./support/toast";

/**
 * F2qp6FtE (ega qarori 2026-11-16) — market o'z operatoriga O'ZI to'laydi, Elchi kassasiga ta'sir qilmaydi
 * (1440, market): «Operatorlar → To'lovlar» tabi, jami va har operator hisobi, «To'lov yozish» (oyna → tasdiq →
 * `POST finance/operator-payments` + `Idempotency-Key`), tarix va «Bekor qilish» (sabab bilan). Kassa so'rovlari yo'q.
 */
test.describe.configure({ timeout: 180_000 });

/**
 * Bugun — Toshkent kuni (`YYYY-MM-DD`), ilovadagi `todayIso` bilan bir xil qoida. Yuguruvchining mahalliy soati emas:
 * `TZ` berilmagan muhitda (bulut konteyneri, lokal UTC) 19:00–24:00 UTC oralig'ida Toshkentda allaqachon ertangi kun.
 */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());

test("⭐ «To'lovlar» tabi: hisob, «To'lov yozish» tasdiq bilan, tarixda yangi yozuv; kassaga tegmaydi", async ({ page }) => {
  const mock = await openMarketOperators(page);

  await page.getByRole("navigation", { name: "Operatorlar bo'limlari" }).getByRole("link", { name: "To'lovlar" }).click();
  await expect(page).toHaveURL(/\/market-operators\?view=payments$/);
  await expect(page.getByText("Baraka Shop operatorlariga bergan to'lovlaringiz hisobi — Elchi kassasiga ta'sir qilmaydi")).toBeVisible();

  const kpi = page.getByRole("region", { name: "Operatorlar hisobi, jami" });
  await expect(kpi).toContainText("1 802 500");
  const balances = page.getByRole("table", { name: "Operatorlar hisobi" });
  await expect(balances.getByRole("row", { name: /Madina Xoliqova/ })).toContainText("186 500 so'm");
  await expect(balances.getByRole("row", { name: /Sevara Usmonova/ })).toContainText("Ortiqcha to'langan");
  const history = page.getByRole("table", { name: "To'lovlar tarixi" });
  await expect(history.getByRole("row", { name: /Sentabr/ })).toContainText("Elchi kassasidan");

  await page.getByRole("button", { name: "To'lov yozish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "To'lov yozish" });
  await expect(dialog).toContainText("Elchi kassasiga ta'sir qilmaydi");
  await dialog.getByRole("combobox", { name: "Operator" }).click();
  await page.getByRole("option", { name: /Madina Xoliqova/ }).click();
  await dialog.getByRole("textbox", { name: "Summa" }).fill("150000");
  await dialog.getByRole("textbox", { name: /Izoh/ }).fill("Noyabr, 2-qism");
  await dialog.getByRole("button", { name: "To'lov yozish" }).click();

  const confirm = page.getByRole("alertdialog", { name: "To'lovni tasdiqlang" });
  await expect(confirm).toContainText("Elchi kassasiga ta'sir qilmaydi");
  await expect(confirm).toContainText("150 000");
  await expect(confirm).toContainText("Yozuvdan keyingi qoldiq36 500 so'm");
  await confirm.getByRole("button", { name: "To'lovni yozish" }).click();

  await expect(toast(page, "To'lov yozildi", { tone: "success" })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(mock.payments).toHaveLength(1);
  expect(mock.payments[0].body).toEqual({ operator_id: "41", amount: 150000, paid_at: today(), note: "Noyabr, 2-qism" });
  expect(mock.payments[0].key).toMatch(/\S{8,}/);
  await expect(history.getByRole("row").nth(1)).toContainText("Noyabr, 2-qism");
  await expect(balances.getByRole("row", { name: /Madina Xoliqova/ })).toContainText("36 500 so'm");

  expect(mock.cashboxRequests).toEqual([]);
  expect(mock.leaked).toEqual([]);
  await expectNoHorizontalOverflow(page);
});

test("⭐ «Bekor qilish»: sabab majburiy → yozuv «Bekor qilingan», qoldiq qaytadi", async ({ page }) => {
  const mock = await openMarketOperators(page);
  await page.goto("/market-operators?view=payments");
  const history = page.getByRole("table", { name: "To'lovlar tarixi" });
  const row = history.getByRole("row", { name: /Noyabr, 1-qism/ });
  await row.getByRole("button", { name: /to'lovini bekor qilish/ }).click();

  const dialog = page.getByRole("dialog", { name: "To'lov yozuvini bekor qilish" });
  await expect(dialog).toContainText("Madina Xoliqova · 300 000 so'm · 15.11.2026");
  await dialog.getByRole("button", { name: "Bekor qilish" }).click();
  await expect(dialog.getByText("Sababni yozing (kamida 3 belgi)")).toBeVisible();
  expect(mock.cancels).toEqual([]);

  await dialog.getByRole("textbox", { name: /Sabab/ }).fill("Summa xato kiritildi");
  await dialog.getByRole("button", { name: "Bekor qilish" }).click();
  await expect(toast(page, "To'lov yozuvi bekor qilindi", { tone: "success" })).toBeVisible();
  expect(mock.cancels).toEqual([{ id: "305", body: { reason: "Summa xato kiritildi" } }]);
  await expect(row).toContainText("Bekor qilingan");
  await expect(row).toContainText("Sabab: Summa xato kiritildi");
  await expect(row.getByRole("button", { name: /bekor qilish/ })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Operatorlar hisobi" }).getByRole("row", { name: /Madina Xoliqova/ })).toContainText(
    "486 500 so'm",
  );
  expect(mock.cashboxRequests).toEqual([]);
});

test("«Operatorlar» qator menyusi → «To'lov yozish» — operator tanlangan oyna", async ({ page }) => {
  await openMarketOperators(page);
  await page.getByRole("button", { name: "Sevara Usmonova amallari" }).click();
  await page.getByRole("menuitem", { name: "To'lov yozish" }).click();
  const dialog = page.getByRole("dialog", { name: "To'lov yozish" });
  await expect(dialog.getByRole("combobox", { name: "Operator" })).toContainText("Sevara Usmonova");
  await expect(dialog).toContainText("Ortiqcha to'langan: 30 000 so'm");
});
