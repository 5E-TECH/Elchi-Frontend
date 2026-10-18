import { expect, test } from "@playwright/test";
import { clippedTiles, mainHorizontalOverflow, mockIntegrationsApi, openElchiOverview } from "./support/integrations";

/**
 * INTEGRATSIYA — UMUMIY HOLAT, 1440×900 (dizayn v2, maket `*-external-console`).
 *
 * Yuqorida uch ustun (Tayyorlik ro'yxati · Muvaffaqiyat · Hodisalar tarkibi), ostida uch blok
 * (Posilkalar / Kiruvchi webhooklar / COD) BITTA qatorda: bir xil tepa, chapdan o'ngga, tayyorlik
 * ro'yxatidan pastda. Sahifada gorizontal skroll yo'q, raqamlar kesilmaydi.
 */

test.describe("Integratsiya umumiy holati — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("uch blok bitta qatorda, tayyorlik ro'yxati ostida; gorizontal skroll yo'q, raqamlar to'liq", async ({ page }) => {
    const { leaked } = await mockIntegrationsApi(page);
    await openElchiOverview(page);

    const checklist = page.getByTestId("ovw-checklist");
    await expect(checklist).toContainText("Tayyorlik ro'yxati");
    const checklistBox = (await checklist.boundingBox())!;
    const blocks = ["ovw-shipments", "ovw-webhooks", "ovw-cod"];
    const boxes = await Promise.all(blocks.map(async (id) => (await page.getByTestId(id).boundingBox())!));
    let previousRight = 0;
    for (const [index, box] of boxes.entries()) {
      // Bitta qator: tepasi bir xil, har biri oldingisidan o'ngda, hammasi tayyorlik ro'yxatidan pastda.
      expect(Math.abs(box.y - boxes[0].y), blocks[index]).toBeLessThanOrEqual(1);
      expect(box.x, blocks[index]).toBeGreaterThanOrEqual(previousRight - 1);
      expect(box.y, blocks[index]).toBeGreaterThanOrEqual(checklistBox.y + checklistBox.height - 1);
      previousRight = box.x + box.width;
    }

    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await clippedTiles(page)).toEqual([]);
    // COD summalari to'liq va qarz Hisob-kitob manbasidan (guruh ajratuvchisi — probel).
    await expect(page.getByTestId("ovw-cod")).toContainText(/Yopilmagan qarz111\D?111\D?111 so'm/);
    expect(leaked).toEqual([]);
  });

  test("ESKI backend / hodisa yo'q: bloklar bo'sh emas, qiymatlar \"—\"", async ({ page }) => {
    const { leaked } = await mockIntegrationsApi(page, { extended: false });
    await openElchiOverview(page);

    await expect(page.getByText("24 soatda hodisa bo'lmagan")).toBeVisible();
    for (const id of ["ovw-shipments", "ovw-webhooks"]) {
      const labels = await page
        .getByTestId(id)
        .locator("button[aria-label]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
      expect(labels.length, id).toBeGreaterThan(0);
      for (const label of labels) expect(label, id).toMatch(/: —\./);
    }
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
