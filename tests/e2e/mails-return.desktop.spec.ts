import { expect, test } from "@playwright/test";
import { mockReturnApi, openReturnTab } from "./support/mailsReturn";
import { expectToast } from "./support/toast";

/** Pochta → Qaytarish (YEI06cPN) — 1440px. */
test.describe("Pochta → Qaytarish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC2: return_requested buyurtmalar — kuryer guruhi va har buyurtma qatori ko'rinadi", async ({ page }) => {
    const { leaked } = await mockReturnApi(page);
    await openReturnTab(page);

    await expect(page.getByText("Jami qaytarish so'rovlari")).toBeVisible();
    await expect(page.getByText("2 ta buyurtma qaytarish so'rovi")).toBeVisible();
    await expect(page.getByText("Aliyev Vali")).toBeVisible();
    await expect(page.getByText("Karimova Nodira")).toBeVisible();
    await expect(page.getByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ TC3: buyurtma tanlanib \"Tasdiqlash\" → POST approve 2xx { order_ids }, qator ro'yxatdan yo'qoladi", async ({ page }) => {
    const { actions, leaked } = await mockReturnApi(page);
    await openReturnTab(page);

    // Dizayn v2: jadval qatoridagi belgi — «⟨mijoz⟩ so'rovini tanlash».
    await page.getByRole("checkbox", { name: "Aliyev Vali so'rovini tanlash" }).check();
    await expect(page.getByRole("region", { name: "Tanlangan so'rovlar" })).toContainText("1 ta so'rov tanlandi");
    const response = page.waitForResponse(
      (res) => res.url().endsWith("/post/return-requests/approve") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    const approve = await response;
    expect(approve.status()).toBeGreaterThanOrEqual(200);
    expect(approve.status()).toBeLessThan(300);
    expect(actions).toEqual([{ type: "approve", body: { order_ids: ["1251170"] }, status: 201 }]);

    await expect(page.getByText("Aliyev Vali")).toHaveCount(0);
    await expect(page.getByText("Karimova Nodira")).toBeVisible();
    await expectToast(page, "1 ta buyurtma omborga qaytarildi", { tone: "success" });
    expect(leaked).toEqual([]);
  });

  test("guruhni butunlay tasdiqlash → ro'yxat bo'shaydi va bo'sh holat matni chiqadi", async ({ page }) => {
    const { actions } = await mockReturnApi(page);
    await openReturnTab(page);

    // Guruh qatoridagi belgi — «⟨kuryer⟩: barchasini tanlash» (faqat shu kuryer).
    await page.getByRole("checkbox", { name: "Baxodir Kuryer: barchasini tanlash" }).check();
    await page.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(page.getByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).toBeVisible();
    expect(actions.map((action) => [action.type, (action.body as { order_ids: string[] }).order_ids.sort()])).toEqual([
      ["approve", ["1251170", "1251171"]],
    ]);
  });
});
