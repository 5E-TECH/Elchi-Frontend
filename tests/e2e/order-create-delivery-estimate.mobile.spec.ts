import { expect, test } from "@playwright/test";
import {
  fakeDeliveryQuote,
  mainHorizontalOverflow,
  MARKET_TARIFFS,
  MEASURED_PRODUCTS,
  mockOrderCreateApi,
  openManualCreate,
} from "./support/orderCreate";

/**
 * 6NYcXvGy — 390px TELEFON, uz / ru / en: taxminiy yetkazish narxi bloki formani buzmaydi (gorizontal skroll yo'q,
 * blok ekran ichida, matn ≥ 12px), narx va o'lchovsiz mahsulot ogohlantirishi har tilda.
 */
const CASES = [
  {
    language: "uz",
    amount: "≈ 39 000 so'm",
    warning: "1 ta mahsulotda o'lchov yo'q — narx ularsiz hisoblandi",
  },
  {
    language: "ru",
    amount: "≈ 39 000 сум",
    warning: "У 1 товара нет габаритов — цена рассчитана без него",
  },
  {
    language: "en",
    amount: "≈ 39,000 UZS",
    warning: "1 product has no measurements — the price was calculated without it",
  },
] as const;

test.describe("Buyurtma yaratish — taxminiy yetkazish narxi (6NYcXvGy), 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const { language, amount, warning } of CASES) {
    test(`${language}: narx va ogohlantirish, blok ekranga sig'adi, toshish yo'q`, async ({
      page,
    }) => {
      const { leaked } = await mockOrderCreateApi(page, {
        profile: { ...MARKET_TARIFFS, settings: { appearance: { theme: "light", language } } },
        products: MEASURED_PRODUCTS,
        quote: fakeDeliveryQuote,
      });
      await openManualCreate(page);

      await page.getByRole("button", { name: /Termos/ }).click();
      await page.getByRole("button", { name: /Eski mahsulot/ }).click();
      const estimate = page.getByTestId("delivery-estimate");
      await expect(estimate).toHaveText(amount);
      await expect(page.getByTestId("delivery-unmeasured")).toHaveText(warning);

      const block = estimate.locator("xpath=ancestor::*[@role='group'][1]");
      await block.scrollIntoViewIfNeeded();
      const box = (await block.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
      // Blok matni 12px dan kichik emas va qatorlar o'z kengligidan chiqmaydi.
      const lines = await block.locator("p, span").evaluateAll((nodes) =>
        nodes.map((node) => ({
          size: parseFloat(getComputedStyle(node).fontSize),
          overflow: node.scrollWidth - node.clientWidth,
        })),
      );
      expect(Math.min(...lines.map((line) => line.size))).toBeGreaterThanOrEqual(12);
      expect(lines.filter((line) => line.overflow > 1)).toEqual([]);
      expect(leaked).toEqual([]);
    });
  }
});
