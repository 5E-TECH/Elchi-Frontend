import { expect, test } from "@playwright/test";
import { mockBranchListApi, openBranchList } from "./support/branchList";

/**
 * FILIALLAR RO'YXATI — sahifalash `data.meta.total` dan (13 ta filial).
 * Ilgari jami joriy sahifa uzunligi bo'lib qolardi: jadvalda HQ Toshkent,
 * kartada 5 ta filial yetib bo'lmas edi.
 */
test.describe("Filiallar ro'yxati — sahifalash, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  const pageButton = (page: import("@playwright/test").Page, label: string) =>
    page.locator("button").filter({ hasText: new RegExp(`^${label}$`) });

  test("⭐ jadval (12/sahifa): \"1-12 dan 13\", 2-sahifa bor, unda HQ Toshkent", async ({ page }) => {
    const { leaked, listRequests } = await mockBranchListApi(page, "table");
    await openBranchList(page);

    await expect(page.getByText("1-12 dan 13 tasi ko'rsatilmoqda")).toBeVisible();
    await expect(page.getByText("HQ Toshkent")).toHaveCount(0);
    await expect(pageButton(page, "2")).toBeVisible();

    await pageButton(page, "2").click();
    await expect(page.getByText("13-13 dan 13 tasi ko'rsatilmoqda")).toBeVisible();
    await expect(page.getByText("HQ Toshkent").first()).toBeVisible();
    expect(listRequests).toEqual(["page=1&limit=12", "page=2&limit=12"]);
    expect(leaked).toEqual([]);
  });

  test("⭐ karta (8/sahifa): \"1-8 dan 13\", 2-sahifada qolgan 5 ta (HQ bilan)", async ({ page }) => {
    const { leaked, listRequests } = await mockBranchListApi(page, "card");
    await openBranchList(page);

    await expect(page.getByText("1-8 dan 13 tasi ko'rsatilmoqda")).toBeVisible();
    await pageButton(page, "2").click();
    await expect(page.getByText("9-13 dan 13 tasi ko'rsatilmoqda")).toBeVisible();
    for (const name of ["Samarqand filiali", "Sirdaryo filiali", "Surxondaryo filiali", "Toshkent viloyati filiali", "HQ Toshkent"]) {
      await expect(page.getByText(name).first(), name).toBeVisible();
    }
    expect(listRequests).toEqual(["page=1&limit=8", "page=2&limit=8"]);
    expect(leaked).toEqual([]);
  });
});
