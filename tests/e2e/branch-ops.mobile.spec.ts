import { expect, test } from "@playwright/test";
import { mockBranchOpsApi, openBranchOps } from "./support/branchOps";

/** /batches — 390px (iPhone 12): «Yangi buyurtmali filiallar» kartalarda, karta — filial sahifasiga havola (≥ 44 px). */
test.describe("Filiallar — operatsiyalar — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kartalar filiallarni ko'rsatadi, bekor qilish formasi yo'q; gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockBranchOpsApi(page);
    await openBranchOps(page);
    const cards = page.getByRole("list", { name: "Yangi buyurtmali filiallar" }).getByRole("listitem");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("Urganch filiali");
    await expect(cards.nth(0)).toContainText("7 ta");
    await expect(page.getByRole("textbox", { name: /Paket ID/ })).toHaveCount(0);

    const link = cards.nth(0).getByRole("link", { name: "Urganch filiali — filial sahifasini ochish" });
    await expect(link).toHaveAttribute("href", "/branches/12");
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
