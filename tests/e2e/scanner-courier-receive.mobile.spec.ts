import { expect, test } from "@playwright/test";
import { BRANCH_TOKEN, mockCourierScanTakeApi, TRANSFER_TOKEN } from "./support/courierScanTake";
import { expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";
import { enterScanCode } from "./support/universalScanner";

/**
 * 390px, COURIER-SCAN (ega, 2026-11-17): KURYER SKANI = QABUL, soxta backend.
 *   1) `/scan`: kuryerda faqat «O'zimga olish» va «Ma'lumot» (alohida «Qabul qilish» rejimi yo'q); yo'ldagi o'tkazma
 *      buyurtmasi skanerlansa — «Sizga biriktirildi», `PATCH post/receive` yuborilmaydi;
 *   2) «Buyurtmalar»: olingan buyurtma «Kutilayotgan» da, yorlig'i «Kuryerda», faqat «Sotish | Bekor qilish» —
 *      «Sotish» bir bosishda sotadi;
 *   3) `/scan/:token`: «O'zimga olish» → shu sahifada darhol «Sotish» / «Bekor qilish» (skanerga qaytmaydi).
 */
test.use(FAKE_CAMERA);

test.describe("Kuryer skani = qabul, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ skan → «O'zimga olish» → ro'yxat («Kuryerda», «Qabul qilish» yo'q) → «Sotish» → sotildi", async ({ page }) => {
    const api = await mockCourierScanTakeApi(page);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "O'zimga olish" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("radio")).toHaveText(["O'zimga olish", "Ma'lumot"]);
    await expectNoHorizontalScroll(page);

    await enterScanCode(page, page.locator("body"), TRANSFER_TOKEN, "Olish");
    await expect(page.getByText("№10401 · Dilnoza Karimova")).toBeVisible();
    expect(api.assigns).toEqual([TRANSFER_TOKEN]);

    await page.goto("/orders");
    const list = page.getByRole("list", { name: "Kutilayotgan buyurtmalar" });
    await expect(list.getByRole("button", { name: "Dilnoza Karimova: sotish" })).toBeVisible({ timeout: 60_000 });
    await expect(list.getByText("Kuryerda")).toBeVisible();
    await expect(list.getByText("Yo'lda")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /qabul qilish/i })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await list.getByRole("button", { name: "Dilnoza Karimova: sotish" }).click();
    const dialog = page.getByRole("dialog", { name: "Sotish" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(api.sells).toEqual(["10401"]);
    await expect(list.getByRole("button", { name: "Dilnoza Karimova: sotish" })).toHaveCount(0);
    expect(api.leaked).toEqual([]);
  });

  test("natija sahifasi: «O'zimga olish» → shu sahifada «Sotish» / «Bekor qilish» → sotildi", async ({ page }) => {
    const api = await mockCourierScanTakeApi(page);
    await page.goto(`/scan/${BRANCH_TOKEN}`);

    const take = page.getByRole("button", { name: "O'zimga olish" });
    await expect(take).toBeEnabled({ timeout: 60_000 });
    await take.click();
    await expect(page.getByText("Buyurtma sizga biriktirildi")).toBeVisible();
    expect(api.assigns).toEqual([BRANCH_TOKEN]);

    const sell = page.getByRole("button", { name: "Sotish" });
    await expect(sell).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Bekor qilish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Qabul qilish" })).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/scan/${BRANCH_TOKEN}$`));
    await expectNoHorizontalScroll(page);
    await sell.click();
    const dialog = page.getByRole("dialog", { name: "Sotish" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sotish" }).click();

    await expect(page).toHaveURL(/\/scan$/, { timeout: 30_000 });
    await expect(page.getByRole("radio", { name: "O'zimga olish" })).toHaveAttribute("aria-checked", "true");
    expect(api.sells).toEqual(["10402"]);
    expect(api.leaked).toEqual([]);
  });
});
