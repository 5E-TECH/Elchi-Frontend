import { expect, test, type Page } from "@playwright/test";
import { mockCourierScanApi } from "./support/universalScanner";

/**
 * kkDkrAIz — kamera ishlamaganda `/scan` (kuryer) xatosi o'zbekcha, brauzerning xom inglizcha matni
 * («Camera not found.», «The request is not allowed by the user agent …») ekranga chiqmaydi.
 *   - Haqiqiy brauzer, kamera ruxsati berilmagan kontekst: `webkit-iphone` (iPhone 12, Safari) va `mobile-390`.
 *   - Telegram ichidagi brauzer (user-agent): ruxsat rad etilgan — «Brauzerda ochish» yo'riqnomasi (maket
 *     `courier-scan-permission-denied` naqshida, qadamlar `camera.denied.steps.telegram`).
 */
test.describe.configure({ timeout: 90_000 });

/** Ekrandagi (ko'rinadigan) matn: inglizcha kamera xatosi so'zlari yo'q. */
const expectNoRawCameraText = async (page: Page) => {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\bCamera\b/);
  expect(text).not.toMatch(/not allowed|user agent|NotAllowedError|NotFoundError|Permission denied|not found/i);
};

test("⭐ kamera ruxsati yo'q: xato kartasi o'zbekcha, «Camera» va brauzer matni yo'q, qo'lda kiritish bor", async ({ page }) => {
  const api = await mockCourierScanApi(page);
  await page.goto("/scan");
  await expect(page.getByRole("heading", { name: "O'zimga olish" })).toBeVisible({ timeout: 60_000 });

  // Brauzerga qarab: ruxsat rad etildi / kamera yo'q / ochilmadi — har biri o'zbekcha sarlavha bilan.
  const title = page
    .getByText(/^(Kameraga ruxsat berilmagan|Bu qurilmada kamera qo'llab-quvvatlanmaydi|Kamera band|Kamera ochilmadi)$/)
    .first();
  // Ruxsat holati asinxron aniqlanadi: so'ralmagan bo'lsa — izoh kartasi («Kameraga ruxsat bering») → «Kamerani yoqish».
  const enable = page.getByRole("button", { name: "Kamerani yoqish" });
  await expect(enable.or(title)).toBeVisible({ timeout: 30_000 });
  if (await enable.isVisible()) {
    await expectNoRawCameraText(page);
    await enable.click();
  }
  await expect(title).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Qo'lda kiritish" }).first()).toBeVisible();
  await expectNoRawCameraText(page);
  expect(api.leaked).toEqual([]);
});

test.describe("Telegram ichidagi brauzer", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/11.2",
  });

  test("⭐ ruxsat rad etilgan: «Brauzerda ochish» yo'riqnomasi, «Qayta urinish» va qo'lda kiritish", async ({ page }) => {
    // iOS Telegram WebView: getUserMedia bloklangan — ruxsat holati «denied», ishga tushirish NotAllowedError.
    await page.addInitScript(() => {
      const denied = { state: "denied", onchange: null, addEventListener() {}, removeEventListener() {} };
      const query = navigator.permissions?.query?.bind(navigator.permissions);
      if (navigator.permissions) {
        Object.defineProperty(navigator.permissions, "query", {
          configurable: true,
          value: (descriptor: { name: string }) =>
            descriptor?.name === "camera" ? Promise.resolve(denied) : (query?.(descriptor as PermissionDescriptor) ?? Promise.resolve(denied)),
        });
      }
      if (navigator.mediaDevices) {
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: () => Promise.reject(new DOMException("The request is not allowed by the user agent or the platform in the current context.", "NotAllowedError")),
        });
      }
    });
    const api = await mockCourierScanApi(page);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "O'zimga olish" })).toBeVisible({ timeout: 60_000 });

    await expect(page.getByText("Kameraga ruxsat berilmagan", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText("Telegram ichidagi brauzerda kamera ishlamaydi. Sahifani brauzerda oching yoki kodni qo'lda kiriting."),
    ).toBeVisible();
    for (const step of ["Yuqoridagi «⋯» menyusini oching", "«Brauzerda ochish»ni tanlang", "Brauzerda kameraga ruxsat bering"]) {
      await expect(page.getByText(step, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Qo'lda kiritish" }).first()).toBeVisible();
    await expectNoRawCameraText(page);
    expect(api.leaked).toEqual([]);
  });
});
