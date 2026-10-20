import { expect, test } from "@playwright/test";
import { APPROVE_DIALOG, mockLogisticsOpsApi, openApproveDialog, openLogisticsOps } from "./support/logisticsOps";
import { expectToast } from "./support/toast";

/** Ops → Logistika (OS-3) — 390px: tasdiq oynasi pastki varaqa, tugmalar ≥ 44px, gorizontal skroll yo'q. */
test.describe("Ops → Logistika: tasdiqlash oynasi — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("pastki varaqa ekranga sig'adi; tasdiqlangach muvaffaqiyat xabari", async ({ page }) => {
    const { leaked, approveBodies } = await mockLogisticsOpsApi(page, (body) => ({
      status: 200,
      body: {
        statusCode: 200,
        data: { approved: (body as { order_ids: string[] }).order_ids.length, skipped_order_ids: [] },
      },
    }));
    await openLogisticsOps(page);
    const dialog = await openApproveDialog(page);

    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // Pastki varaqa — ekranning pastiga yopishgan.
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
    for (const name of ["Bekor qilish", "7 tasini tasdiqlash"]) {
      const button = (await dialog.getByRole("button", { name }).boundingBox())!;
      expect(button.height, `${name}: telefonda ≥ 44px`).toBeGreaterThanOrEqual(44);
      expect(button.x + button.width, name).toBeLessThanOrEqual(390);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await dialog.getByRole("button", { name: "7 tasini tasdiqlash" }).click();
    await expect(page.getByRole("alertdialog", { name: APPROVE_DIALOG })).toHaveCount(0);
    await expectToast(page, "7 ta tasdiqlandi", { tone: "success" });
    await expect(page.getByText("Yangi so'rov kelganda shu yerda ko'rinadi.")).toBeVisible();
    expect(approveBodies).toHaveLength(1);
    expect(leaked).toEqual([]);
  });
});
