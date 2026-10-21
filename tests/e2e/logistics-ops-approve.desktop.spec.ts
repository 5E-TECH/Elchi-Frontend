import { expect, test } from "@playwright/test";
import { APPROVE_DIALOG, mockLogisticsOpsApi, openApproveDialog, openLogisticsOps } from "./support/logisticsOps";
import { expectToast } from "./support/toast";

/** Ops → Logistika (OS-3): qaytarish so'rovlarini tasdiqlash oynasi va natija xabari — desktop. */
test.describe("Ops → Logistika: tasdiqlash oynasi va natija", () => {
  test.describe.configure({ timeout: 90_000 });

  test("oyna kuryer guruhlarini ko'rsatadi; qisman natija — ogohlantirish xabari; ro'yxat yangilanadi", async ({ page }) => {
    const { leaked, approveBodies } = await mockLogisticsOpsApi(page, () => ({
      status: 200,
      body: {
        statusCode: 200,
        message: "Qaytarish so'rovlari tasdiqlandi — buyurtmalar omborga qaytarildi",
        data: { approved: 6, order_ids: ["10244", "10241", "10223", "10229", "10250", "10198"], skipped_order_ids: ["10236"] },
      },
    }));
    await openLogisticsOps(page);
    const dialog = await openApproveDialog(page);

    await expect(dialog).toContainText("7 ta buyurtma kuryerlardan olinadi va HQ omboriga qaytariladi.");
    await expect(dialog).toContainText("+ 1 ta buyurtma kuryersiz");
    const groups = dialog.getByRole("list", { name: "Kuryerlar bo'yicha" });
    await expect(groups).toContainText("Jasur Tursunov");
    await expect(groups).toContainText("+ yana 2 ta");
    await expect(groups).toContainText("Kuryer biriktirilmagan");
    await expect(dialog).toContainText("Bu amalni bekor qilib bo'lmaydi.");
    // Oyna kengligi — maket 480 px.
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(481);

    await dialog.getByRole("button", { name: "7 tasini tasdiqlash" }).click();
    await expect(page.getByRole("alertdialog", { name: APPROVE_DIALOG })).toHaveCount(0);
    await expectToast(page, "6 ta tasdiqlandi, 1 tasi o'tkazib yuborildi", { tone: "warning" });
    await expectToast(page, "№10236 ni shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.", { tone: "warning" });
    expect(approveBodies).toEqual([{ order_ids: ["10244", "10241", "10223", "10236", "10229", "10250", "10198"] }]);

    // Ro'yxat yangilandi — bo'sh holat (maket `superadmin-ops-logistics-approve-result`).
    await expect(page.getByText("Qaytarish so'rovlari yo'q")).toBeVisible();
    await expect(page.getByText("Yangi so'rov kelganda shu yerda ko'rinadi.")).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("403 — oyna ochiq qoladi, xom backend matni emas, i18n sabab", async ({ page }) => {
    const { leaked } = await mockLogisticsOpsApi(page, () => ({
      status: 403,
      body: { statusCode: 403, message: "Bu buyurtma filial kuryerida — qaytarish so'rovini shu filial menejeri ko'rib chiqadi" },
    }));
    await openLogisticsOps(page);
    const dialog = await openApproveDialog(page);

    await dialog.getByRole("button", { name: "7 tasini tasdiqlash" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Ayrim buyurtmalar boshqa filial kuryerida — ularni o'sha filial ko'rib chiqadi.",
    );
    await expect(page.getByText("qaytarish so'rovini shu filial menejeri ko'rib chiqadi")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(page.getByRole("alertdialog", { name: APPROVE_DIALOG })).toHaveCount(0);
    // Tanlov saqlanadi — qayta urinish mumkin.
    await expect(page.getByRole("button", { name: "Tasdiqlash — 7 ta" })).toBeEnabled();
    expect(leaked).toEqual([]);
  });
});
