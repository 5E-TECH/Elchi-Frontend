import { expect, test } from "@playwright/test";
import { CRITICAL, healthCard, mockSystemOpsApi, openSystemOps } from "./support/systemOps";

/** /ops?tab=system — 390px: xizmatlar kartalarda, gorizontal skroll yo'q, tugmalar ≥ 44 px. */
test.describe("Ops → Tizim — Tizim holati — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("asosiy xizmat ishlamayapti: kartalar ro'yxati, ekranga sig'adi, bosish nishonlari ≥ 44 px", async ({ page }) => {
    const { leaked } = await mockSystemOpsApi(page, { health: [CRITICAL] });
    await openSystemOps(page);
    const card = healthCard(page);
    await expect(card.getByText("Asosiy xizmat ishlamayapti: Buyurtmalar")).toBeVisible();

    const items = card.getByRole("list", { name: "Xizmatlar holati" }).getByRole("listitem");
    await expect(items).toHaveCount(14);
    await expect(items.nth(0)).toContainText("Buyurtmalar");
    await expect(items.nth(0)).toContainText("ORDER · asosiy · 38 ms");
    await expect(items.nth(0)).toContainText("Xizmat xato qaytardi");
    await expect(items.nth(1)).toContainText("AI buyurtma");
    await expect(items.nth(1)).toContainText("Noma'lum");
    await expect(card.getByRole("table")).toHaveCount(0);

    for (const name of ["Yangilash", /Xizmatlar ro'yxatini yashirish/]) {
      const box = await card.getByRole("button", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const outside = await page
      .locator("[data-shell-slot=content] li, [data-shell-slot=content] button, [role='status']")
      .evaluateAll((elements) =>
        elements
          .map((el) => ({ text: el.textContent?.trim().slice(0, 30) ?? el.tagName, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1))
          .map(({ text }) => text),
      );
    expect(outside).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
