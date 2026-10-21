import { expect, test } from "@playwright/test";
import {
  batchIdInput,
  cancelBatchButton,
  confirmBatchCancel,
  mockBranchOpsApi,
  openBranchOps,
  reasonInput,
} from "./support/branchOps";

/** /branch-ops — 390px (iPhone 12): ro'yxat kartalarda, forma va xato ekranga sig'adi, tasdiq pastki varaqada. */
test.describe("Filiallar — operatsiyalar — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kartalar filiallarni ko'rsatadi; 400 da i18n xato matni (server xabari emas); gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockBranchOpsApi(page, {
      cancel: () => ({ status: 400, body: { statusCode: 400, message: "Partiya topilmadi" } }),
    });
    await openBranchOps(page);
    const cards = page.getByRole("list", { name: "Yangi buyurtmali filiallar" }).getByRole("listitem");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("Urganch filiali");
    await expect(cards.nth(0)).toContainText("7 ta");

    await batchIdInput(page).fill("18");
    await reasonInput(page).fill("Noto'g'ri viloyatga yuborilgan");
    await cancelBatchButton(page).click();
    await confirmBatchCancel(page);
    const alert = page.getByRole("alert").filter({ hasText: "Paketni bekor qilib bo'lmadi" });
    await expect(alert).toContainText("Ma'lumot qabul qilinmadi (400). Kiritilganini tekshirib, qayta urinib ko'ring.");
    await expect(alert).not.toContainText("Partiya topilmadi");

    const outside = await page
      .locator("[data-shell-slot=content] li, [role='alert'], textarea, button")
      .evaluateAll((elements) =>
        elements
          .map((el) => ({ text: el.textContent?.trim().slice(0, 30) ?? el.tagName, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1))
          .map(({ text }) => text),
      );
    expect(outside).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Asosiy tugma telefonda ≥ 44 px.
    const box = await cancelBatchButton(page).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(leaked).toEqual([]);
  });
});
