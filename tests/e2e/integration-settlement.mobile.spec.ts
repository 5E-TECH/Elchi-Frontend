import { expect, test } from "@playwright/test";
import { mainHorizontalOverflow, mockSettlementApi, openSettlement } from "./support/integrationSettlement";

/** Integratsiya → Hisob-kitob (IS-1) — 390px: gorizontal skroll yo'q, oyna pastdan, tugmalar ≥ 44px. */
test.describe("Integratsiya — Hisob-kitob, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("«Qoldiq» sig'adi, to'lov oynasi pastki varaqa, tugmalar ≥ 44px", async ({ page }) => {
    const { leaked } = await mockSettlementApi(page);
    await openSettlement(page);

    const balance = page.getByRole("region", { name: "Qoldiq" });
    await expect(balance).toContainText(/To'lanishi kerak\s*4\s510\s000/);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);

    const payButton = balance.getByRole("button", { name: "To'lov olindi" });
    expect((await payButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await payButton.click();

    const dialog = page.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize()!;
    // Varaqa pastdan siljib chiqadi — joyiga tushguncha kutamiz.
    await expect
      .poll(async () => {
        const box = (await dialog.boundingBox())!;
        return Math.abs(box.y + box.height - viewport.height);
      })
      .toBeLessThanOrEqual(1);
    expect((await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    for (const name of ["Orqaga", "Yozish"]) {
      expect((await dialog.getByRole("button", { name }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
    }
    expect(leaked).toEqual([]);
  });
});
