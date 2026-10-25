import { expect, test } from "@playwright/test";
import { HQ_MANAGER_PROFILE, mockNewOrdersCameraApi } from "./support/newOrdersCamera";
import { expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";

/**
 * 390px, sensorli qurilma (Trello vNcGDnNh 1-band): «Qabul qilish» → «Marketni tanlang» varag'i ochilganda qidiruv
 * maydoniga avtomatik fokus berilmaydi — telefonda klaviatura o'zi chiqib, market ro'yxatini yopib qo'ymaydi.
 * Qidiruvga foydalanuvchi o'zi bosganda fokus oladi va ro'yxat filtrlanadi.
 */
test.use(FAKE_CAMERA);

test.describe("Skaner: tanlash varag'i va klaviatura, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("varaqa ochilganda qidiruv fokussiz, ro'yxat to'liq ko'rinadi; bosilganda qidiradi", async ({ page }) => {
    const { leaked } = await mockNewOrdersCameraApi(page, { profile: HQ_MANAGER_PROFILE });
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "QR skaner" })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("radio", { name: "Qabul qilish" }).click();
    const sheet = page.getByRole("dialog", { name: "Marketni tanlang" });
    const search = sheet.getByRole("searchbox", { name: "Qidirish" }).or(sheet.getByRole("textbox", { name: "Qidirish" }));
    await expect(sheet.getByRole("button", { name: /Ipak Yo'li Savdo/ })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Baraka Shop/ })).toBeVisible();
    await expect(search).not.toBeFocused();
    // Fokus varaqa ichida (fokus tuzog'i), lekin matn maydonida emas.
    expect(await sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);

    await search.click();
    await expect(search).toBeFocused();
    await search.fill("Baraka");
    await expect(sheet.getByRole("button", { name: /Baraka Shop/ })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Ipak Yo'li Savdo/ })).toBeHidden();
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });
});
