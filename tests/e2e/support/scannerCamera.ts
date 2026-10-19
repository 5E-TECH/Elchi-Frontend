import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Kontekstli kamera (Trello v1eLN2tV 2-bosqich) e2e yordamchilari: markaziy «Skaner» tugmasi sahifa maqsadini
 * ochadi (`aria-label` «Skaner — <sarlavha>»), telefonda kamera — to'liq ekran oyna (nomi — maqsad sarlavhasi).
 * Kod «Qo'lda kiritish» varag'i orqali beriladi (soxta kamerada QR yo'q) — kamera skani bilan bitta handler.
 */

/** Soxta kamera (ruxsat berilgan): kamera faol holatda ochiladi. `test.use(FAKE_CAMERA)`. */
export const FAKE_CAMERA = {
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--host-resolver-rules=MAP api.elchipochta.uz ~NOTFOUND",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
};

/** Markaziy «Skaner» tugmasi (pastki menyu) — shu sahifa maqsadi bilan. */
export const openScannerFromBottomNav = async (page: Page, title: string) => {
  await page.getByRole("link", { name: `Skaner — ${title}` }).click();
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
};

/** «Qo'lda kiritish» varag'i orqali kod. */
export const enterCode = async (page: Page, camera: Locator, code: string) => {
  await camera.getByRole("button", { name: "Qo'lda kiritish" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Kodni qo'lda kiriting" });
  await sheet.getByRole("textbox").fill(code);
  await sheet.getByRole("button", { name: "Qo'shish" }).click();
  await expect(sheet).toBeHidden();
};

export const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};
