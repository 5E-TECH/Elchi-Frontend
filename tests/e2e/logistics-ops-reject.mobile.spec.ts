import { expect, test } from "@playwright/test";
import { mockLogisticsOpsApi, openLogisticsOps } from "./support/logisticsOps";
import { expectToast } from "./support/toast";

/**
 * `/returns` → «Qaytarish so'rovlari» — rad etish (2026-11-07), 390px: tanlov panelida «Rad etish» «Tasdiqlash» yonida
 * (maket yo'q — eng yaqini `superadmin-mails-return`), tasdiq oynasi pastki varaqa, `POST post/return-requests/reject`.
 */
const REJECT_DIALOG = "Qaytarish so'rovlarini rad eting";

test.describe("Qaytarish so'rovlari: rad etish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: panel ekranga sig'adi, oyna pastki varaqa, rad etilgach xabar va ro'yxat bo'shaydi`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem("theme-version", "2");
        window.localStorage.setItem("theme", value);
      }, theme);
      // Kirgach server sozlamasi ustun — profilda ham shu mavzu (aks holda sukut — kunduzgi).
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
      const { leaked, approveBodies, rejectBodies } = await mockLogisticsOpsApi(
        page,
        () => ({ status: 500, body: {} }),
        undefined,
        (body) => ({
          status: 200,
          body: {
            statusCode: 200,
            data: {
              rejected: (body as { order_ids: string[] }).order_ids.length,
              skipped_order_ids: [],
            },
          },
        }),
      );
      await openLogisticsOps(page);

      const reject = page.getByRole("button", { name: "Rad etish", exact: true });
      await expect(reject).toBeDisabled();
      await page.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }).first().check();
      await expect(reject).toBeEnabled();
      const panel = page.getByRole("region", { name: "Tanlangan so'rovlar" });
      const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const name of ["Tanlovni bekor qilish", "Rad etish", "Tasdiqlash — 7 ta"]) {
        const box = (await panel.getByRole("button", { name, exact: true }).boundingBox())!;
        boxes[name] = box;
        expect(box.x, name).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, name).toBeLessThanOrEqual(390);
        expect(box.height, `${name}: telefonda ≥ 44px`).toBeGreaterThanOrEqual(44);
      }
      // «Pochta → Qaytarish» maketidagidek: «Rad etish» va «Tasdiqlash» bir qatorda, «Tanlovni bekor qilish» — ostida.
      expect(Math.abs(boxes["Rad etish"].y - boxes["Tasdiqlash — 7 ta"].y)).toBeLessThan(2);
      expect(boxes["Rad etish"].x).toBeLessThan(boxes["Tasdiqlash — 7 ta"].x);
      expect(boxes["Tanlovni bekor qilish"].y).toBeGreaterThan(boxes["Rad etish"].y);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(0);
      await testInfo.attach(`logistics-reject-panel-390-${theme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      if (process.env.E2E_SHOTS_DIR)
        await page.screenshot({
          path: `${process.env.E2E_SHOTS_DIR}/logistics-reject-panel-390-${theme}.png`,
        });

      await reject.click();
      const dialog = page.getByRole("alertdialog", { name: REJECT_DIALOG });
      await expect(dialog).toBeVisible();
      // O'lchash ochilish animatsiyasi tugagach (yuklangan mashinada transform paytida 43,9999 px chiqardi).
      await dialog.evaluate((node) =>
        Promise.all(node.ownerDocument.getAnimations().map((animation) => animation.finished)),
      );
      const box = (await dialog.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
      for (const name of ["Bekor qilish", "7 tasini rad etish"]) {
        const button = (await dialog.getByRole("button", { name }).boundingBox())!;
        expect(button.height, `${name}: telefonda ≥ 44px`).toBeGreaterThanOrEqual(44);
      }
      await testInfo.attach(`logistics-reject-dialog-390-${theme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      if (process.env.E2E_SHOTS_DIR)
        await page.screenshot({
          path: `${process.env.E2E_SHOTS_DIR}/logistics-reject-dialog-390-${theme}.png`,
        });

      await dialog.getByRole("button", { name: "7 tasini rad etish" }).click();
      await expect(dialog).toHaveCount(0);
      await expectToast(page, "7 ta so'rov rad etildi", { tone: "success" });
      await expect(page.getByText("Yangi so'rov kelganda shu yerda ko'rinadi.")).toBeVisible();
      expect(rejectBodies).toEqual([
        { order_ids: ["10244", "10241", "10223", "10236", "10229", "10250", "10198"] },
      ]);
      expect(approveBodies).toEqual([]);
      expect(leaked).toEqual([]);
    });
  }
});
