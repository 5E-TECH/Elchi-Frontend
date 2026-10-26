import { expect, test } from "@playwright/test";
import { mockShiftAccounts, PNG_1X1 } from "./support/shiftAccounts";

/**
 * kiZgTybn (1440): smena yopish oynasida kartalar qoldig'i — rasm majburiy kartada skrinshot yuklanmaguncha yopilmaydi,
 * rasm yuklangach AI «Mos keldi», AI o'chiq karta qo'lda tasdiqlanadi; yuborishda `accounts[]` va Σ karta;
 * natija oynasidan «Smena hisoboti» → hisobot sahifasi (kartalar, AI holati, rasm havolasi).
 */
test("superadmin: kartalar qoldig'i, skrinshot, AI holati → yopish → smena hisoboti", async ({ page }) => {
  const mock = await mockShiftAccounts(page);
  await page.goto("/payments/main-cashbox");

  await page.getByRole("button", { name: "Smenani yopish" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Smenani yopish" });
  const section = dialog.getByTestId("shift-accounts-section");
  await expect(section).toContainText("Kartalar va hisob raqamlar");
  await expect(dialog.getByLabel(/^Sanalgan karta/)).toHaveCount(0);
  const main = dialog.getByTestId("shift-account-1");
  const account = dialog.getByTestId("shift-account-3");
  await expect(main).toContainText("Agrobank · ··1234");
  await expect(main).toContainText(/2\s140\s000/);
  await expect(account).toContainText("AI tekshiruvi o'chirilgan — qoldiq qo'lda tasdiqlanadi");

  await dialog.getByLabel(/^Sanalgan naqd/).fill("18240000");
  await main.getByLabel(/^Ilovadagi qoldiq/).fill("2140000");
  await account.getByLabel(/^Ilovadagi qoldiq/).fill("1450000");
  await dialog.getByRole("button", { name: "Smenani yopish" }).click();
  await expect(main).toContainText("Skrinshot majburiy — avval rasm yuklang");
  expect(mock.closes).toEqual([]);

  await dialog.getByTestId("shift-photo-input-1").setInputFiles({ name: "IMG_2210.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(main).toContainText("IMG_2210.png");
  await expect(main).toContainText(/AI rasmdan 2\s140\s000 so'm o'qidi/);
  await expect(main.getByText("Mos keldi")).toBeVisible();
  expect(mock.uploads).toBe(1);

  await dialog.getByRole("button", { name: "Smenani yopish" }).click();
  const result = page.getByRole("dialog", { name: "Smena yopildi" });
  await expect(result).toBeVisible();
  expect(mock.closes).toEqual([
    {
      shift_id: "31",
      closing_balance_cash: 18_240_000,
      closing_balance_card: 3_590_000,
      accounts: [
        { card_id: "1", entered_balance: 2_140_000 },
        { card_id: "3", entered_balance: 1_450_000 },
      ],
    },
  ]);

  await result.getByRole("link", { name: "Smena hisoboti" }).click();
  await expect(page).toHaveURL(/\/payments\/shifts\/31$/);
  await expect(page.getByRole("heading", { level: 1, name: "Smena hisoboti" })).toBeVisible();
  const table = page.getByRole("table", { name: "Kartalar bo'yicha natijalar" });
  await expect(table).toContainText("Asosiy karta");
  await expect(table).toContainText("Mos keldi");
  await expect(table).toContainText("Sozlamada o'chirilgan");
  await expect(table.getByRole("link", { name: /Ochish/ })).toHaveAttribute("href", "https://files.example/signed/1");
  // Gorizontal toshish yo'q.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});
