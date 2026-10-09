import { expect, test } from "@playwright/test";
import { mockBranchOpsApi, openBranchOps } from "./support/branchOps";

/** /branch-ops — 390px (iPhone 12): jadval to'ladi, forma va xato ekranga sig'adi. */
test.describe("Filiallar — operatsiyalar — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("jadval filiallarni ko'rsatadi; 400 xabari ko'rinadi; gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockBranchOpsApi(page, {
      cancel: () => ({ status: 400, body: { statusCode: 400, message: "Partiya topilmadi" } }),
    });
    await openBranchOps(page);
    await expect(page.locator(".ant-table-tbody tr.ant-table-row")).toHaveCount(2);
    await expect(page.getByText("Urganch filiali")).toBeVisible();

    await page.getByLabel("batch-id").fill("18");
    await page.getByLabel("Bekor qilish sababi").fill("Noto'g'ri viloyatga yuborilgan");
    await page.getByRole("button", { name: "Batchni bekor qilish" }).click();
    await page.getByRole("button", { name: "Ha, bekor qilish" }).click();
    const alert = page.locator(".ant-alert-error");
    await expect(alert).toContainText("Partiya topilmadi");

    const outside = await page
      .locator(".ant-table, .ant-alert-error, textarea, button")
      .evaluateAll((elements) =>
        elements
          .map((el) => ({ text: el.textContent?.trim().slice(0, 30) ?? el.tagName, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1))
          .map(({ text }) => text),
      );
    expect(outside).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
