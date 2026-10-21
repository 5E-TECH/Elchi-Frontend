import { expect, test, type Page } from "@playwright/test";
import {
  AT_HQ_TRACKING,
  HANDED_TRACKING,
  mockCancelStagesApi,
  ORDER_AT_HQ,
  ORDER_HANDED,
  ORDER_IN_TRANSIT,
} from "./support/cancelStages";

/**
 * BEKOR HOLATLARI — 390px. Telefon kartasida bosqich belgisi va alohida joy qatori; tafsilotda «Qaytarish yo'li»
 * ekranga sig'adi (gorizontal skroll yo'q).
 */
const MARKET = { id: "m7", role: "market", name: "Baraka Shop", status: "active", cancelled_handover_qr_required: true };

const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("Bekor bosqichi — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ ro'yxat kartalari: «Bekor · HQ'da» + «Toshkent HQ · 2 kun», «→ Toshkent HQ», «Marketga topshirildi»", async ({ page }) => {
    const { leaked } = await mockCancelStagesApi(page, { list: [ORDER_AT_HQ, ORDER_IN_TRANSIT, ORDER_HANDED] });
    await page.goto("/orders");
    const hqCard = page.getByRole("link").filter({ hasText: "Malika Yusupova" });
    await expect(hqCard).toBeVisible({ timeout: 60_000 });
    await expect(hqCard.getByText("Bekor · HQ'da")).toBeVisible();
    await expect(hqCard.getByTestId("cancel-return-place")).toHaveText("Toshkent HQ · 2 kun");

    const transitCard = page.getByRole("link").filter({ hasText: "Shahnoza Ergasheva" });
    await expect(transitCard.getByText("Bekor · yo'lda")).toBeVisible();
    await expect(transitCard.getByTestId("cancel-return-place")).toHaveText("→ Toshkent HQ");

    const handedCard = page.getByRole("link").filter({ hasText: "Dilnoza Karimova" });
    await expect(handedCard.getByText("Marketga topshirildi", { exact: true })).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(leaked).toEqual([]);
  });

  test("⭐ market tafsiloti: «Qaytarish yo'li» — «Posilka hozir: Toshkent HQ», «QR kodni ochish» 44px, toshish yo'q", async ({
    page,
  }) => {
    const { leaked } = await mockCancelStagesApi(page, {
      profile: MARKET,
      details: [{ ...ORDER_AT_HQ, market_id: "m7" }],
      tracking: { "10235": AT_HQ_TRACKING },
    });
    await page.goto("/orders/edit/10235");
    const card = page.getByTestId("order-return-path");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText("Posilka hozir: Toshkent HQ — olib ketishingiz mumkin");
    await expect(card.getByTestId("return-path-step")).toHaveCount(3);
    await expect(card.getByTestId("return-path-pending")).toContainText("Olib ketishingiz kutilmoqda · Toshkent HQ · 2 kun");
    const qr = card.getByRole("link", { name: "QR kodni ochish" });
    await expect(qr).toHaveAttribute("href", "/new-orders/cancelled/m7");
    const box = await qr.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(leaked).toEqual([]);
  });

  test("superadmin tafsiloti: «Marketga topshirildi» va usul belgisi ekranga sig'adi", async ({ page }) => {
    await mockCancelStagesApi(page, { details: [ORDER_HANDED], tracking: { "10241": HANDED_TRACKING } });
    await page.goto("/orders/edit/10241");
    const card = page.getByTestId("order-return-path");
    await expect(card.getByTestId("return-path-method")).toHaveText("QR orqali", { timeout: 60_000 });
    await expect(page.locator("main header").first().getByText("Marketga topshirildi", { exact: true })).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});
