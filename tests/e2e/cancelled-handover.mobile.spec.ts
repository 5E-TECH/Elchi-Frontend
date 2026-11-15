import { expect, test } from "@playwright/test";
import { MARKET_PIN, MARKET_QR, mockCancelledApi, openHandover, pendingOrder, scanOrders, usbScan } from "./support/cancelledHandover";

/**
 * Bekor qilinganlarni marketga topshirish — 390px: kartalar, «QR buzilganini tasdiqlash» pastki varaqasi
 * (sabab — backend enum kodi), market QR bilan topshirish. SKAN = TOPSHIRISH (ega qarori 2026-11-15): skanerlangani
 * darhol topshirilib «Topshirildi» kartasiga o'tadi; gorizontal skroll yo'q.
 */
test.describe("Bekor qilinganlar — telefon, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("QR buzilgan buyurtma ruxsat ichida qo'lda topshiriladi (sabab — enum kodi), qolganlari skan bilan", async ({ page }) => {
    const { leaked, handovers } = await mockCancelledApi(page);
    await openHandover(page);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Market QR'siz qo'lda topshirish ham o'chiq (backend ruxsat tokenini so'raydi).
    const damaged = page.getByRole("button", { name: "QR buzilgan" }).first();
    await expect(damaged).toBeDisabled();

    await usbScan(page, MARKET_QR);
    await expect(page.getByText("Market QR skanerlandi")).toBeVisible();
    // Market QR hech narsani yubormaydi.
    expect(handovers).toEqual([]);

    await expect(damaged).toBeEnabled();
    expect((await damaged.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await damaged.click();
    const sheet = page.getByRole("dialog", { name: "QR buzilganini tasdiqlash" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radio", { name: "Yorliq yo'qolgan" }).check();
    await sheet.getByRole("button", { name: "Qo'lda topshirish" }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => handovers.length).toBe(1);
    expect(handovers[0]).toEqual({
      order_ids: ["10235"],
      authorization_token: "auth-e2e",
      manual_overrides: [{ order_id: "10235", reason: "Label yo'qolgan" }],
    });
    await expect(pendingOrder(page, "10235")).toHaveCount(0);
    await expect(page.getByTestId("handed-over-card").getByText("Qo'lda tasdiq — Yorliq yo'qolgan")).toBeVisible();

    await scanOrders(page, ["10220", "10213"], handovers);
    await expect(page.getByText("Hammasi topshirildi")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(leaked).toEqual([]);
  });

  // zkRab9M2 (BG6): kod oynasi telefonda pastki varaqa — maydon va tugmalar ≥ 44 px, gorizontal skroll yo'q.
  test("PIN kod bilan (pastki varaqa): to'g'ri kod — ruxsat, skan token bilan topshiradi", async ({ page }) => {
    const { leaked, pins, handovers } = await mockCancelledApi(page);
    await openHandover(page);

    const open = page.getByRole("button", { name: "PIN kodni kiritish" });
    expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await open.click();
    const sheet = page.getByRole("dialog", { name: "Market PIN kodi" });
    await expect(sheet).toBeVisible();
    const input = sheet.getByRole("textbox", { name: /6 xonali PIN/ });
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("inputmode", "numeric");
    // Varaqa ekranga sig'adi va (ochilish harakati tugagach) pastga yopishgan.
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390 + 0.5);
    await expect
      .poll(async () => {
        const current = (await sheet.boundingBox())!;
        return Math.round(current.y + current.height);
      })
      .toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
    expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const confirm = sheet.getByRole("button", { name: "Tasdiqlash" });
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await input.fill(MARKET_PIN);
    await confirm.click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Market PIN kodi tasdiqlandi")).toBeVisible();
    expect(pins).toEqual([{ market_id: "201", pin: MARKET_PIN }]);
    // Kod hech narsani yubormaydi — buyurtmalar skanerlangani sari topshiriladi.
    expect(handovers).toEqual([]);

    await scanOrders(page, ["10235", "10220", "10213"], handovers);
    expect(handovers.every((body) => body.authorization_token === "auth-pin-e2e")).toBe(true);
    expect(leaked).toEqual([]);
  });
});
