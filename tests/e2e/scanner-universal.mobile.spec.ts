import { expect, test } from "@playwright/test";
import { cameraDialog, HQ_MANAGER_PROFILE, mockNewOrdersCameraApi, OWN_TOKEN } from "./support/newOrdersCamera";
import { enterCode, expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";
import { COURIER_TOKENS, enterScanCode, mockCourierScanApi } from "./support/universalScanner";

/**
 * 390px: universal skaner `/scan` rejimlari (Trello v1eLN2tV 3-bosqich).
 *   - kuryer: sukut «O'zimga olish» — har kod `POST orders/scan-assign`, kamera yopilmaydi, ro'yxat, «Tugatish» → xulosa;
 *   - HQ menejeri: «Qabul qilish» → market varag'i → `/new-orders/:id`, kamera O'SHA sahifada ochiq (skan = qabul).
 */
test.use(FAKE_CAMERA);

test.describe("Universal skaner rejimlari, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kuryer: 2 ta kod → 2 ta scan-assign, natija ro'yxati, «Tugatish» → xulosa", async ({ page }) => {
    const api = await mockCourierScanApi(page);
    await page.goto("/scan");
    const camera = page.locator("body");
    await expect(page.getByRole("heading", { name: "O'zimga olish" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("radio", { name: "O'zimga olish" })).toHaveAttribute("aria-checked", "true");

    const [first, second] = Object.keys(COURIER_TOKENS);
    await enterScanCode(page, camera, first, "Olish");
    await expect(page.getByText("№10191 · Lobar Yusupova")).toBeVisible();
    await enterScanCode(page, camera, second, "Olish");
    await expect(page.getByText("№10172 · Sardor Qodirov")).toBeVisible();
    expect(api.assigns).toEqual([first, second]);

    await page.getByRole("button", { name: "Ro'yxat" }).click();
    const list = page.getByRole("dialog", { name: "Skanerlanganlar" });
    await expect(list.getByText("№10191 · Lobar Yusupova")).toBeVisible();
    await expect(list.getByText("Sizga biriktirildi · Mirzo Ulug'bek tumani")).toBeVisible();
    await list.getByRole("button", { name: "Davom etish" }).click();
    await expect(list).toBeHidden();

    await page.getByRole("button", { name: "Tugatish" }).click();
    const summary = page.getByRole("dialog", { name: "Skanerlash yakunlandi" });
    await expect(summary.getByText("2 ta buyurtma sizga biriktirildi")).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(api.leaked).toEqual([]);
  });

  test("HQ menejeri: «Qabul qilish» → market → /new-orders/:id, kamera ochiq; skan = qabul", async ({ page }) => {
    const { leaked, received } = await mockNewOrdersCameraApi(page, { profile: HQ_MANAGER_PROFILE });
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "QR skaner" })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("radio", { name: "Qabul qilish" }).click();
    const sheet = page.getByRole("dialog", { name: "Marketni tanlang" });
    await expect(sheet.getByText("2 ta yangi buyurtma")).toBeVisible();
    await sheet.getByRole("button", { name: /Ipak Yo'li Savdo/ }).click();

    await expect(page).toHaveURL(/\/new-orders\/121$/);
    const dialog = cameraDialog(page);
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText("Ipak Yo'li Savdo · 2 ta buyurtma")).toBeVisible();

    await enterCode(page, dialog, OWN_TOKEN);
    await expect.poll(() => received).toEqual([["10254"]]);

    // Bayroq tozalangan: sahifa yangilansa kamera o'zi qayta ochilmaydi.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" })).toBeVisible({ timeout: 60_000 });
    await expect(cameraDialog(page)).toBeHidden();
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });
});
