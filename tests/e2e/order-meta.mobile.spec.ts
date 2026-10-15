import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_96 } from "./support/orderDetail";

/**
 * BUYURTMA MA'LUMOTLARI (OrderMeta) — 390px.
 * Gorizontal skroll yo'q, telefon havolalari va tarif bloki ekranga sig'adi,
 * tarif sukut bo'yicha xira va ko'z tugmasi ochadi.
 */
test.describe("Buyurtma ma'lumotlari — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("hammasi ekranga sig'adi; tarif xira → ko'z bilan ochiladi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page);
    await openOrderDetail(page);

    const meta = page.getByTestId("order-meta");
    await meta.scrollIntoViewIfNeeded();
    const inside = await meta.evaluate((root) =>
      Array.from(root.querySelectorAll<HTMLElement>("a, button, dd, [data-testid^='meta-']"))
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el: el.textContent?.trim().slice(0, 30) ?? el.tagName, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.left < -1 || r.right > window.innerWidth + 1)
        .map(({ el }) => el),
    );
    expect(inside).toEqual([]);

    const value = meta.locator('[data-tariff="marketTariff"] dd');
    await expect(value).toHaveClass(/blur-sm/);
    await meta.locator("button[aria-pressed]").click();
    await expect(value).not.toHaveClass(/blur-sm/);
    await expect(value).toContainText(/70\D?000 so'm/);

    const overflow = await page
      .locator("main.el-surface-page")
      .evaluate((main) => main.scrollWidth - main.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ ota buyurtma banneri: matn so'zma-so'z o'ralmaydi, havola ekranda va bosiladi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page);
    await openOrderDetail(page);

    const banner = page.getByTestId("order-parent-banner");
    const text = page.getByTestId("order-parent-banner-text");
    const link = banner.locator("a");
    await expect(text).toHaveText("Bu buyurtma #95 ning qisman sotuvidan qolgan qismi");
    const [bannerBox, textBox, linkBox] = await Promise.all([banner.boundingBox(), text.boundingBox(), link.boundingBox()]);
    // Matn bannerning deyarli butun kengligini oladi (ilgari ~50px ustun bo'lib qolardi).
    expect(textBox!.width).toBeGreaterThan(bannerBox!.width * 0.6);
    const lineHeight = await text.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(Math.round(textBox!.height / lineHeight)).toBeLessThanOrEqual(2);
    expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(390);
    await expect(link).toHaveAttribute("href", "/orders/edit/95");
    expect(leaked).toEqual([]);
  });

  test.describe("brauzer UTC zonasida", () => {
    test.use({ timezoneId: "UTC" });

    test("⭐ qatorlar o'ralmaydi: yorliq va qiymat BIR chiziqda; sana Toshkentda (kun siljimaydi)", async ({ page }) => {
      const { leaked } = await mockOrderDetailApi(page, {
        ...ORDER_96,
        // Uzun qiymatlar — tor ekranda kesilishi (o'ralmasligi) tekshiriladi.
        market: { id: "m7", name: "Juda uzun nomli market MChJ filial savdo", phone_number: "+998992222222" },
        sold_at: "2026-07-19T20:30:00.000Z",
      });
      await openOrderDetail(page);

      const rows = await page.getByTestId("order-meta").evaluate((root) =>
        Array.from(root.querySelectorAll<HTMLElement>("[data-testid^='meta-']"))
          .filter((row) => row.querySelector("[data-meta-label]"))
          .map((row) => {
            const label = row.querySelector<HTMLElement>("[data-meta-label]")!.getBoundingClientRect();
            const value = row.querySelector<HTMLElement>("[data-meta-value]")!.getBoundingClientRect();
            return {
              id: row.dataset.testid,
              rowHeight: Math.round(row.getBoundingClientRect().height),
              labelHeight: Math.round(label.height),
              valueHeight: Math.round(value.height),
              sameLine: Math.abs(label.top + label.height / 2 - (value.top + value.height / 2)) <= 4,
              noOverlap: label.right <= value.left + 1,
              inside: value.right <= window.innerWidth,
            };
          }),
      );
      expect(rows.length).toBeGreaterThanOrEqual(7);
      for (const row of rows) {
        expect(row.sameLine, `${row.id}: yorliq va qiymat bir chiziqda`).toBe(true);
        expect(row.noOverlap, `${row.id}: yorliq va qiymat ustma-ust emas`).toBe(true);
        expect(row.inside, `${row.id}: ekrandan chiqmaydi`).toBe(true);
        expect(row.labelHeight, `${row.id}: yorliq bir qator`).toBeLessThan(24);
        expect(row.valueHeight, `${row.id}: qiymat bir qator`).toBeLessThan(32);
      }
      // Uzun nom kesilgan, telefon esa to'liq va bosiladi.
      await expect(page.getByTestId("meta-market").locator("a")).toHaveText("+998992222222");
      // UTC brauzerda ham Toshkent vaqti: 19-iyul 20:30Z → 20.07.2026, 01:30.
      await expect(page.getByTestId("meta-sold-at")).toContainText("20.07.2026, 01:30:00");
      expect(leaked).toEqual([]);
    });
  });
});
