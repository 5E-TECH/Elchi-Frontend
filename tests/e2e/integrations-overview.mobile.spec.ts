import { expect, test } from "@playwright/test";
import { clippedTiles, mainHorizontalOverflow, mockIntegrationsApi, openElchiOverview } from "./support/integrations";

/**
 * INTEGRATSIYA — UMUMIY HOLAT, 390px TELEFON.
 *
 * Bloklar USTMA-UST joylashadi, raqamlar (uzun COD summalari ham) kesilmaydi,
 * banner tugmalari esa sarlavhani siqib qo'ymaydi.
 */

test.describe("Integratsiya umumiy holati — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("bloklar ustma-ust, raqamlar kesilmaydi, gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockIntegrationsApi(page);
    await openElchiOverview(page);

    const checklist = page.locator(".ant-card", { hasText: "Tayyorlik checklisti" }).first();
    const columnBoxes = [
      (await checklist.boundingBox())!,
      ...(await Promise.all(
        ["ovw-shipments", "ovw-webhooks", "ovw-cod"].map(async (id) => (await page.getByTestId(id).boundingBox())!),
      )),
    ];
    // Bitta ustun: chap chegara va kenglik bir xil, har biri oldingisidan pastda.
    for (let i = 1; i < columnBoxes.length; i += 1) {
      expect(Math.abs(columnBoxes[i].x - columnBoxes[0].x), `blok ${i}`).toBeLessThanOrEqual(1);
      expect(Math.abs(columnBoxes[i].width - columnBoxes[0].width), `blok ${i}`).toBeLessThanOrEqual(1);
      expect(columnBoxes[i].y, `blok ${i}`).toBeGreaterThanOrEqual(columnBoxes[i - 1].y + columnBoxes[i - 1].height - 1);
    }

    expect(await clippedTiles(page)).toEqual([]);
    // Eng uzun summa to'liq (guruh ajratuvchisi brauzer locale'iga bog'liq).
    await expect(page.getByTestId("ovw-cod")).toContainText(/1\D?234\D?567\D?890 so'm/);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("banner: sarlavha siqilmaydi, amallar o'z qatorida", async ({ page }) => {
    const { leaked } = await mockIntegrationsApi(page);
    await openElchiOverview(page);

    const title = page.locator(".ant-alert-title").first();
    const titleBox = (await title.boundingBox())!;
    // Avval uch tugma sarlavhani ~0px ga siqib, harfma-harf sindirardi.
    expect(titleBox.width).toBeGreaterThan(200);
    const actions = page.getByTestId("ovw-actions");
    await expect(actions.getByText("Aloqani sinash")).toBeVisible();
    await expect(actions.getByText("Yangilash")).toBeVisible();
    const actionsBox = (await actions.boundingBox())!;
    expect(actionsBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
