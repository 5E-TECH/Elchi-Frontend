import { expect, test, type Locator } from "@playwright/test";
import { mockOrderProofApi, ORDER_95_KEY, proofOrder } from "./support/orderProof";

/**
 * BUYURTMA DALILLARI — detal sahifasi, 390px.
 *
 * Fayl baytlari JWT bilan `GET files/:key/content` dan olinadi va rasm HAQIQATAN
 * yuklanadi (naturalWidth > 0); lightbox ekranga sig'adi; ochiq `files/view` CHAQIRILMAYDI.
 * Hech qanday so'rov serverga ketmaydi.
 */

const KEYS = [
  "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot.png",
  "proof-1784557173686-20818f3a-6482-4bb3-b092-f85b18057d9b-ikkinchi.jpg",
];

const mockApi = (page: import("@playwright/test").Page, keys: string[]) =>
  mockOrderProofApi(page, { order: proofOrder({ proof_files: keys }) });

/**
 * Lightbox antd Modal'da — ochilishda "zoom" animatsiyasi bor. O'lcham animatsiya
 * tugagach (ketma-ket ikki o'lchov bir xil) olinadi, aks holda yuklangan mashinada
 * rasm hali kichrayib turgan paytda o'lchanadi (flaky).
 */
const settledBox = async (locator: Locator) => {
  let previous = "";
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const current = box ? [box.x, box.y, box.width, box.height].map(Math.round).join(",") : "";
      const settled = current !== "" && current === previous;
      previous = current;
      return settled;
    }, { intervals: [100] })
    .toBe(true);
  return (await locator.boundingBox())!;
};

test.describe("Buyurtma dalillari — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("#95: bitta rasm ko'rinadi va bosilganda KATTALASHADI", async ({ page }) => {
    const { leaked, fileCalls } = await mockApi(page, [ORDER_95_KEY]);
    await page.goto("/orders/edit/95");
    const card = page.getByTestId("order-proof-card");
    await expect(card).toBeVisible({ timeout: 60_000 });

    const thumb = card.locator('[data-testid="proof-gallery"] img');
    await expect(thumb).toHaveCount(1);
    await expect.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const small = (await thumb.boundingBox())!;

    await card.locator("button[aria-label^='Dalilni ochish']").click();
    const big = page.getByTestId("proof-lightbox").locator("img");
    await expect(big).toBeVisible();
    const large = await settledBox(big);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.x + large.width).toBeLessThanOrEqual(390);
    expect(fileCalls).toEqual([`files/${ORDER_95_KEY}/content`]);
    expect(leaked).toEqual([]);
  });

  test("Dalillar kartasi, haqiqiy rasm, lightbox ekranga sig'adi; files/view chaqirilmaydi", async ({ page }) => {
    const { leaked, fileCalls } = await mockApi(page, KEYS);
    await page.goto("/orders/edit/95");
    const card = page.getByTestId("order-proof-card");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText("Dalillar");

    // Ikkala rasm HAQIQATAN yuklangan (buzilgan rasm belgisi emas).
    const images = card.locator('[data-testid="proof-gallery"] img');
    await expect(images).toHaveCount(2);
    await expect
      .poll(() => images.evaluateAll((els) => els.map((el) => (el as HTMLImageElement).naturalWidth > 0)))
      .toEqual([true, true]);
    expect(fileCalls.sort()).toEqual(KEYS.map((key) => `files/${key}/content`).sort());
    expect(fileCalls.some((call) => call.includes("files/view"))).toBe(false);

    // Lightbox: rasm ekranga sig'adi, "1 / 2", keyingisiga o'tadi.
    await card.locator("button[aria-label^='Dalilni ochish']").first().click();
    const lightbox = page.getByTestId("proof-lightbox");
    await expect(lightbox.locator("img")).toBeVisible();
    const box = await settledBox(lightbox.locator("img"));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expect(page.getByText("1 / 2")).toBeVisible();
    await lightbox.locator('button[aria-label="Keyingi"]').click();
    await expect(page.getByText("2 / 2")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
