import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockCourierScanApi } from "./support/universalScanner";

/**
 * kkDkrAIz — `/scan` (kuryer) kamera xato holatlari maketdagidek, 390px, kunduzgi va tungi mavzu:
 *   - ruxsat berilmagan — maket `courier-scan-permission-denied` (sarlavha, izoh, 3 qadam, «Qayta urinish»,
 *     «Kodni qo'lda kiritish»);
 *   - kamera band / qurilmada kamera yo'q — taxta `tizim-scanner` 04.14 («Kamera band» + «Qayta urinish» /
 *     «Qo'lda kiritish»; kamera yo'q — faqat qo'lda kiritish).
 * Brauzer kamerasi soxta: ruxsat holati (`permissions.query`) va `getUserMedia` xatosi init skriptda. Har holat
 * skrinshoti test hisobotiga biriktiriladi (PR uchun).
 */
test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 390, height: 844 } });

type CameraMock = { permission: "denied" | "granted"; error: "NotAllowedError" | "NotReadableError" | "NotFoundError" };

const mockCamera = (page: Page, { permission, error }: CameraMock) =>
  page.addInitScript(
    ({ permission, error }) => {
      const status = { state: permission, onchange: null, addEventListener() {}, removeEventListener() {} };
      if (navigator.permissions) {
        Object.defineProperty(navigator.permissions, "query", { configurable: true, value: () => Promise.resolve(status) });
      }
      if (navigator.mediaDevices) {
        // Qurilmada orqa kamera bor (kamera yo'q holatida ham — xato ishga tushirishda keladi).
        Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
          configurable: true,
          value: () =>
            Promise.resolve(
              error === "NotFoundError" ? [] : [{ kind: "videoinput", deviceId: "back", groupId: "g", label: "Back camera" }],
            ),
        });
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: () => Promise.reject(new DOMException("Raw browser message", error)),
        });
      }
    },
    { permission, error },
  );

/** Kamera kartasi (`.el-cam-card`) — sarlavhasi bo'yicha. */
const cameraCard = (page: Page, title: string) =>
  page.locator("section, div").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).last();

const expectFits390 = async (page: Page, card: Locator) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const button of await card.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box!.height, await button.innerText()).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
};

const openScan = async (page: Page) => {
  const api = await mockCourierScanApi(page);
  await page.goto("/scan");
  await expect(page.getByRole("heading", { name: "O'zimga olish" })).toBeVisible({ timeout: 60_000 });
  return api;
};

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} mavzu`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => {
        window.localStorage.setItem("theme", t);
        window.localStorage.setItem("theme-version", "2");
      }, theme);
    });

    test(`⭐ ruxsat berilmagan — maket courier-scan-permission-denied (${theme})`, async ({ page }, testInfo) => {
      await mockCamera(page, { permission: "denied", error: "NotAllowedError" });
      const api = await openScan(page);
      const card = cameraCard(page, "Kameraga ruxsat berilmagan");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText(
        "Brauzer skanerga kamerani ishlatishga ruxsat bermadi. Ruxsatni yoqing yoki kodni qo'lda kiriting.",
      );
      for (const step of [
        "Manzil satridagi qulf belgisini bosing",
        "«Kamera» bandida «Ruxsat berish»ni tanlang",
        "«Qayta urinish» tugmasini bosing",
      ]) {
        await expect(card.getByText(step, { exact: true })).toBeVisible();
      }
      await expect(card.getByRole("button")).toHaveText(["Qayta urinish", "Kodni qo'lda kiritish"]);
      await expectFits390(page, card);
      await testInfo.attach(`permission-denied-${theme}`, { body: await page.screenshot(), contentType: "image/png" });
      expect(api.leaked).toEqual([]);
    });

    test(`⭐ kamera band — tizim-scanner 04.14 (${theme})`, async ({ page }, testInfo) => {
      await mockCamera(page, { permission: "granted", error: "NotReadableError" });
      const api = await openScan(page);
      const card = cameraCard(page, "Kamera band");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText("Kamera boshqa ilovada ochiq. Uni yoping va qayta urining.");
      await expect(card.getByRole("button")).toHaveText(["Qayta urinish", "Qo'lda kiritish"]);
      await expectFits390(page, card);
      await testInfo.attach(`camera-busy-${theme}`, { body: await page.screenshot(), contentType: "image/png" });
      expect(api.leaked).toEqual([]);
    });

    test(`⭐ qurilmada kamera yo'q — tizim-scanner 04.14 (${theme})`, async ({ page }, testInfo) => {
      await mockCamera(page, { permission: "granted", error: "NotFoundError" });
      const api = await openScan(page);
      const card = cameraCard(page, "Bu qurilmada kamera qo'llab-quvvatlanmaydi");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText("Kodni qo'lda kiriting yoki USB skaner ulang.");
      // Kamera yo'q — «Qayta urinish» ma'nosiz, faqat qo'lda kiritish.
      await expect(card.getByRole("button")).toHaveText(["Qo'lda kiritish"]);
      await expectFits390(page, card);
      await testInfo.attach(`camera-unsupported-${theme}`, { body: await page.screenshot(), contentType: "image/png" });
      expect(api.leaked).toEqual([]);
    });
  });
}
