import { expect, test } from "@playwright/test";
import { mockLogisticsOpsApi, openLogisticsOps } from "./support/logisticsOps";

/**
 * `/returns` → «Qaytarish so'rovlari» — rad etish, 1440px: tanlov panelida «Tanlovni bekor qilish» · «✕ Rad etish» ·
 * «✓ Tasdiqlash» bir qatorda (maket yo'q — eng yaqini `superadmin-mails-return`).
 */
test.describe("Qaytarish so'rovlari: rad etish — 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: «Rad etish» «Tasdiqlash» chapida, bitta qatorda; oyna qizil, so'rov ketmaydi (Bekor qilish)`, async ({
      page,
    }, testInfo) => {
      await page.route(/auth\/my-profile$/, (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              status: 200,
              contentType: "application/json",
              headers: {
                "access-control-allow-origin": "http://127.0.0.1:4173",
                "access-control-allow-credentials": "true",
              },
              body: JSON.stringify({
                statusCode: 200,
                data: {
                  id: "1",
                  role: "superadmin",
                  name: "Bosh admin",
                  status: "active",
                  settings: { appearance: { theme, themeChosen: true } },
                },
              }),
            })
          : route.fallback(),
      );
      const { leaked, rejectBodies } = await mockLogisticsOpsApi(
        page,
        () => ({ status: 500, body: {} }),
        undefined,
        () => ({
          status: 200,
          body: { statusCode: 200, data: { rejected: 2, skipped_order_ids: [] } },
        }),
      );
      await openLogisticsOps(page);
      await page.getByRole("checkbox", { name: "So'rov 10244 ni tanlash" }).check();
      await page.getByRole("checkbox", { name: "So'rov 10241 ni tanlash" }).check();

      const panel = page.getByRole("region", { name: "Tanlangan so'rovlar" });
      const [clear, reject, approve] = await Promise.all(
        ["Tanlovni bekor qilish", "Rad etish", "Tasdiqlash — 2 ta"].map(
          async (name) => (await panel.getByRole("button", { name, exact: true }).boundingBox())!,
        ),
      );
      expect(clear.x + clear.width).toBeLessThanOrEqual(reject.x);
      expect(reject.x + reject.width).toBeLessThanOrEqual(approve.x);
      expect(Math.abs(reject.y - approve.y)).toBeLessThan(2);
      expect(Math.abs(clear.y - reject.y)).toBeLessThan(2);
      await testInfo.attach(`logistics-reject-panel-1440-${theme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      if (process.env.E2E_SHOTS_DIR) {
        await page.screenshot({
          path: `${process.env.E2E_SHOTS_DIR}/logistics-reject-panel-1440-${theme}.png`,
        });
      }

      await panel.getByRole("button", { name: "Rad etish", exact: true }).click();
      const dialog = page.getByRole("alertdialog", { name: "Qaytarish so'rovlarini rad eting" });
      await expect(dialog).toContainText("2 ta so'rov rad etiladi");
      if (process.env.E2E_SHOTS_DIR) {
        await page.screenshot({
          path: `${process.env.E2E_SHOTS_DIR}/logistics-reject-dialog-1440-${theme}.png`,
        });
      }
      await dialog.getByRole("button", { name: "Bekor qilish" }).click();
      await expect(dialog).toHaveCount(0);
      expect(rejectBodies).toEqual([]);
      expect(leaked).toEqual([]);
    });
  }
});
