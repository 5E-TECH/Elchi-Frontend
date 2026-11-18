import { expect, test } from "@playwright/test";
import { mockCourierScanTakeApi, TRANSFER_TOKEN } from "./support/courierScanTake";

/**
 * 1440px, COURIER-SCAN (ega, 2026-11-17): KURYER SKANI = QABUL. Skanerlangan buyurtma sahifasida «O'zimga olish»
 * → shu sahifada «Sotish» / «Bekor qilish»; «Buyurtmalar» ro'yxatida — «Kuryerda», faqat «Sotish» + «Bekor qilish»
 * («Qabul qilish» yo'q) → «Sotish» bir bosishda sotadi. `PATCH post/receive` yuborilmaydi.
 */
test.describe("Kuryer skani = qabul — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ skan → «O'zimga olish» → ro'yxat → «Sotish» → sotildi", async ({ page }) => {
    const api = await mockCourierScanTakeApi(page);
    await page.goto(`/scan/${TRANSFER_TOKEN}`);

    const take = page.getByRole("button", { name: "O'zimga olish" });
    await expect(take).toBeEnabled({ timeout: 60_000 });
    await take.click();
    await expect(page.getByText("Buyurtma sizga biriktirildi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sotish" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Qabul qilish" })).toHaveCount(0);
    expect(api.assigns).toEqual([TRANSFER_TOKEN]);

    await page.goto("/orders");
    const row = page.getByRole("row", { name: /Dilnoza Karimova/ });
    await expect(row.getByRole("button", { name: "№10401 ni sotish" })).toBeVisible({ timeout: 60_000 });
    await expect(row.getByText("Kuryerda")).toBeVisible();
    await expect(row.getByRole("button", { name: "№10401 ni bekor qilish" })).toBeVisible();
    await expect(page.getByRole("button", { name: /qabul qilish/i })).toHaveCount(0);

    await row.getByRole("button", { name: "№10401 ni sotish" }).click();
    const dialog = page.getByRole("dialog", { name: "Sotish" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(api.sells).toEqual(["10401"]);
    expect(api.leaked).toEqual([]);
  });
});
