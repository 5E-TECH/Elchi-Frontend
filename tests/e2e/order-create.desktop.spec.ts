import { expect, test, type Locator } from "@playwright/test";
import {
  gridOf,
  mainHorizontalOverflow,
  measureGrid,
  mockOrderCreateApi,
  openManualCreate,
} from "./support/orderCreate";

/**
 * QO'LDA BUYURTMA YARATISH (Step2Combined) — KATTA EKRAN.
 *
 * Telefon uchun tuzatish (`col-span-2` → `sm:col-span-2`) ikki ustunli
 * ko'rinishni buzmasligi kerak: katta ekranda mijoz va tafsilot kartalari
 * yonma-yon, ichida maydonlar 2 ustunda, MANZIL va IZOH esa to'liq qatorda.
 */

const top = async (locator: Locator) => Math.round((await locator.boundingBox())!.y);
const width = async (locator: Locator) => Math.round((await locator.boundingBox())!.width);

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`Qo'lda buyurtma yaratish — ${viewport.width}px`, () => {
    test.use({ viewport });
    test.describe.configure({ timeout: 90_000 });

    test("ikki ustunli ko'rinish buzilmagan", async ({ page }) => {
      const { leaked } = await mockOrderCreateApi(page);
      await openManualCreate(page);

      const name = page.locator('input[name="customer.name"]');
      const phone = page.getByPlaceholder("XX XXX XX XX").first();
      const extraPhone = page.getByPlaceholder("XX XXX XX XX").nth(1);
      const region = page.locator('[id="customer.region_id"]');
      const address = page.locator('textarea[name="customer.address"]');
      const total = page.getByPlaceholder("0", { exact: true });
      const operator = page.locator('input[name="details.operator"]');
      const comment = page.locator('textarea[name="details.comment"]');

      // 1) Mijoz va tafsilot kartalari YONMA-YON.
      const outer = await measureGrid(name.locator("xpath=ancestor::div[contains(@class, 'xl:grid-cols-2')][1]"));
      expect(outer.columns).toHaveLength(2);
      const [customerCard, detailsCard] = await name
        .locator("xpath=ancestor::div[contains(@class, 'xl:grid-cols-2')][1]/div")
        .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y })));
      expect(Math.round(customerCard.y)).toBe(Math.round(detailsCard.y));
      expect(detailsCard.x).toBeGreaterThan(customerCard.x);

      // 2) Mijoz bloki: 2 ustun, juft maydonlar bir qatorda, MANZIL to'liq qatorda.
      const customerGrid = await measureGrid(gridOf(name));
      expect(customerGrid.columns).toHaveLength(2);
      expect(await top(phone)).toBe(await top(extraPhone));
      expect(await top(name)).toBe(await top(region));
      const half = (customerGrid.content - 16) / 2; // sm:gap-4 = 16px
      expect(Math.abs((await width(name)) - half)).toBeLessThanOrEqual(2);
      expect(Math.abs((await width(address)) - customerGrid.content)).toBeLessThanOrEqual(2);

      // 3) Tafsilot bloki: SUMMA va OPERATOR yonma-yon, IZOH to'liq qatorda,
      //    "Markaz" / "Uy" yonma-yon.
      const detailsGrid = await measureGrid(gridOf(comment));
      expect(detailsGrid.columns).toHaveLength(2);
      expect(await top(total)).toBe(await top(operator));
      expect(Math.abs((await width(comment)) - detailsGrid.content)).toBeLessThanOrEqual(2);
      const center = page.getByRole("button", { name: "Markaz", exact: true });
      const home = page.getByRole("button", { name: "Uy", exact: true });
      expect(await top(center)).toBe(await top(home));

      expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(leaked).toEqual([]);
    });
  });
}
