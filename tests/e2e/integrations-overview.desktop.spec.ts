import { expect, test } from "@playwright/test";
import { clippedTiles, mainHorizontalOverflow, mockIntegrationsApi, openElchiOverview } from "./support/integrations";

/**
 * INTEGRATSIYA — UMUMIY HOLAT, 1440×900.
 *
 * Uch yangi blok (Posilkalar / Kiruvchi webhooklar / COD) O'NG ustunga
 * sig'adi: chap ustundagi checklist bilan ustma-ust tushmaydi, sahifada
 * gorizontal skroll yo'q, raqamlar kesilmaydi.
 */

test.describe("Integratsiya umumiy holati — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("uch blok o'ng ustunda, gorizontal skroll yo'q, raqamlar to'liq", async ({ page }) => {
    const { leaked } = await mockIntegrationsApi(page);
    await openElchiOverview(page);

    const checklist = page.locator(".ant-card", { hasText: "Tayyorlik checklisti" }).first();
    const checklistBox = (await checklist.boundingBox())!;
    const blocks = ["ovw-shipments", "ovw-webhooks", "ovw-cod"];
    let previousBottom = 0;
    for (const id of blocks) {
      const box = (await page.getByTestId(id).boundingBox())!;
      // O'ng ustun: checklistdan o'ngda, bir xil chap chegarada.
      expect(box.x, id).toBeGreaterThan(checklistBox.x + checklistBox.width);
      expect(box.y, id).toBeGreaterThan(previousBottom - 1);
      previousBottom = box.y + box.height;
    }
    const lefts = await Promise.all(blocks.map(async (id) => Math.round((await page.getByTestId(id).boundingBox())!.x)));
    expect(new Set(lefts).size).toBe(1);

    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await clippedTiles(page)).toEqual([]);
    // COD summalari to'liq va qarz Hisob-kitob manbasidan (guruh ajratuvchisi
    // brauzer locale ma'lumotiga bog'liq — probel yoki vergul).
    await expect(page.getByTestId("ovw-cod")).toContainText(/Yopilmagan qarz111\D?111\D?111 so'm/);
    expect(leaked).toEqual([]);
  });

  test("ESKI backend / hodisa yo'q: o'ng ustun bo'sh emas, qiymatlar \"—\"", async ({ page }) => {
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
