import { expect, test } from "@playwright/test";
import { clippedTiles, mainHorizontalOverflow, mockIntegrationsApi, openElchiOverview } from "./support/integrations";

/**
 * INTEGRATSIYA — UMUMIY HOLAT, 390px TELEFON (dizayn v2).
 *
 * Tayyorlik ro'yxati va uch blok USTMA-UST bitta ustunda, raqamlar (uzun COD summalari ham) kesilmaydi,
 * amallar qatori («Aloqani sinash», «Yangilash») o'z qatorida, tugmalar ≥ 44px.
 */

test.describe("Integratsiya umumiy holati — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("bloklar ustma-ust, raqamlar kesilmaydi, gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockIntegrationsApi(page);
    await openElchiOverview(page);

    const columnBoxes = await Promise.all(
      ["ovw-checklist", "ovw-shipments", "ovw-webhooks", "ovw-cod"].map(async (id) => (await page.getByTestId(id).boundingBox())!),
    );
    // Bitta ustun: chap chegara va kenglik bir xil, har biri oldingisidan pastda.
    for (let i = 1; i < columnBoxes.length; i += 1) {
      expect(Math.abs(columnBoxes[i].x - columnBoxes[0].x), `blok ${i}`).toBeLessThanOrEqual(1);
      expect(Math.abs(columnBoxes[i].width - columnBoxes[0].width), `blok ${i}`).toBeLessThanOrEqual(1);
      expect(columnBoxes[i].y, `blok ${i}`).toBeGreaterThanOrEqual(columnBoxes[i - 1].y + columnBoxes[i - 1].height - 1);
    }

    expect(await clippedTiles(page)).toEqual([]);
    // Eng uzun summa to'liq.
    await expect(page.getByTestId("ovw-cod")).toContainText(/1\D?234\D?567\D?890 so'm/);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("amallar o'z qatorida: tugmalar ko'rinadi, ≥ 44px va ekranga sig'adi", async ({ page }) => {
    const { leaked } = await mockIntegrationsApi(page);
    await openElchiOverview(page);

    const actions = page.getByTestId("ovw-actions");
    for (const name of ["Aloqani sinash", "Yangilash"]) {
      const button = actions.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.height, name).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width, name).toBeLessThanOrEqual(390);
    }
    // Amallar qatori panel tablari ostida, tayyorlik ro'yxatidan oldin.
    const actionsBox = (await actions.boundingBox())!;
    const checklistBox = (await page.getByTestId("ovw-checklist").boundingBox())!;
    expect(checklistBox.y).toBeGreaterThanOrEqual(actionsBox.y + actionsBox.height - 1);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
