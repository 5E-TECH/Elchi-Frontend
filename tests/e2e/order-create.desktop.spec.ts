import { expect, test, type Locator } from "@playwright/test";
import {
  gridOf,
  mainHorizontalOverflow,
  measureGrid,
  mockOrderCreateApi,
  openManualCreate,
  SUGGESTED_CUSTOMER,
} from "./support/orderCreate";

/**
 * QO'LDA BUYURTMA YARATISH (Step2Combined) — KATTA EKRAN, dizayn v2 (maket `market-new-orders-create-manual`).
 *
 * Telefon uchun tuzatishlar (bitta ustunli gridlar) katta ekrandagi tuzilmani buzmasligi kerak:
 *  - asosiy ustun (mijoz va tafsilot kartalari) va yon ustun («Buyurtma xulosasi») YONMA-YON;
 *  - mijoz bloki: TELEFON · QO'SHIMCHA RAQAM · ISM bitta qatorda (3 ustun); manzil bloki 2 ustunli: VILOYAT ·
 *    TUMAN, «Markazgacha» · «Uygacha», MANZIL · IZOH juft-juft, yetkazish turi to'liq qatorda;
 *  - tafsilot kartasi: katalog (chap) va tanlangan mahsulotlar (o'ng) yonma-yon;
 *  - yon ustunda SUMMA va OPERATOR ustma-ust, to'liq enli.
 */

const top = async (locator: Locator) => Math.round((await locator.boundingBox())!.y);
const left = async (locator: Locator) => Math.round((await locator.boundingBox())!.x);
const width = async (locator: Locator) => Math.round((await locator.boundingBox())!.width);
/** `auto-fit` da bo'sh ustunlar 0px bo'lib qoladi — faqat haqiqiy ustunlar sanaladi. */
const realColumns = (columns: string[]) => columns.filter((column) => parseFloat(column) > 0);

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
      const district = page.locator('[id="customer.district_id"]');
      const address = page.locator('textarea[name="customer.address"]');
      const comment = page.locator('textarea[name="details.comment"]');
      const total = page.getByPlaceholder("0", { exact: true });
      const operator = page.locator('input[name="details.operator"]');
      const customerCard = page.getByRole("region", { name: "Mijoz ma'lumotlari" });
      const summary = page.getByRole("complementary", { name: "Buyurtma xulosasi" });

      // 1) Asosiy ustun va «Buyurtma xulosasi» YONMA-YON (bir xil tepada, xulosa o'ngda).
      expect(await top(summary)).toBe(await top(customerCard));
      expect(await left(summary)).toBeGreaterThan((await left(customerCard)) + (await width(customerCard)));

      // 2) Mijoz bloki: 3 ustun, uchala maydon bir qatorda va teng enli.
      const customerGrid = await measureGrid(gridOf(name));
      expect(realColumns(customerGrid.columns)).toHaveLength(3);
      expect(await top(phone)).toBe(await top(name));
      expect(await top(extraPhone)).toBe(await top(name));
      const third = (customerGrid.content - 2 * 16) / 3; // gap-4 = 16px
      // Maydon qutisi (`TextInput`: chegara + ichki chekka bilan) — ichidagi `<input>` emas.
      const nameBox = name.locator("xpath=ancestor::div[@data-text-input][1]");
      expect(Math.abs((await width(nameBox)) - third)).toBeLessThanOrEqual(2);

      // 3) Manzil bloki: 2 ustun; viloyat · tuman, manzil · izoh juft; yetkazish turi to'liq qatorda.
      const addressGrid = await measureGrid(gridOf(comment));
      expect(realColumns(addressGrid.columns)).toHaveLength(2);
      expect(await top(region)).toBe(await top(district));
      expect(await top(address)).toBe(await top(comment));
      const half = (addressGrid.content - 16) / 2;
      expect(Math.abs((await width(comment)) - half)).toBeLessThanOrEqual(2);
      const deliveryGroup = page.getByRole("group", { name: /Yetkazish turi/ });
      expect(Math.abs((await width(deliveryGroup)) - addressGrid.content)).toBeLessThanOrEqual(2);
      const center = deliveryGroup.locator("label").filter({ hasText: "Markazgacha" });
      const home = deliveryGroup.locator("label").filter({ hasText: "Uygacha" });
      expect(await top(center)).toBe(await top(home));
      expect(await left(home)).toBeGreaterThan(await left(center));

      // 4) Tafsilot kartasi: katalog va tanlangan mahsulotlar yonma-yon.
      const catalog = page.getByRole("list", { name: /katalogi$/ });
      const selectedTitle = page.getByRole("heading", { name: "Tanlangan mahsulotlar" });
      expect(await left(selectedTitle)).toBeGreaterThan((await left(catalog)) + (await width(catalog)));

      // 5) Yon ustun: summa va operator ustma-ust, ikkalasi to'liq enli.
      expect(await top(operator)).toBeGreaterThan(await top(total));
      const boxOf = (field: Locator) => field.locator("xpath=ancestor::div[@data-text-input][1]");
      const asideCard = summary.getByRole("region", { name: "Buyurtma xulosasi" });
      const fieldWidth = (await width(asideCard)) - 2 * 20 - 2; // karta chekkasi 20px + chegara
      expect(Math.abs((await width(boxOf(total))) - fieldWidth)).toBeLessThanOrEqual(2);
      expect(Math.abs((await width(boxOf(operator))) - fieldWidth)).toBeLessThanOrEqual(2);

      expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(leaked).toEqual([]);
    });
  });
}

test.describe("Qo'lda buyurtma yaratish — mijoz taklifi (CS-A), 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("telefon ostida taklif ro'yxati; ↓ Enter bilan tanlanadi, «Mavjud mijoz» bloki va `customer_id`", async ({ page }) => {
    const { leaked, createdOrders } = await mockOrderCreateApi(page, { suggestions: [SUGGESTED_CUSTOMER] });
    await openManualCreate(page);

    const phone = page.getByRole("combobox", { name: /^Telefon/ });
    await phone.click();
    await page.keyboard.type("9034567");

    const list = page.getByRole("listbox", { name: "Mijoz takliflari" });
    await expect(list).toBeVisible();
    await expect(phone).toHaveAttribute("aria-expanded", "true");
    await expect(list).toContainText("Sizning mijozlaringiz · buyurtmalar soni faqat sizda");
    const option = list.getByRole("option", { name: /Shahnoza Abdullayeva/ });
    await expect(option).toContainText("+998 90 345 67 21 · Chilonzor");
    await expect(option).toContainText("4 ta buyurtma");
    await expect(option).toContainText("1 ta yangi");

    // Ro'yxat telefon maydoni ostida, kamida maydon enida va sahifani gorizontal surmaydi.
    const phoneBox = (await phone.locator("xpath=ancestor::div[@data-text-input][1]").boundingBox())!;
    const listBox = (await list.boundingBox())!;
    expect(listBox.y).toBeGreaterThanOrEqual(phoneBox.y + phoneBox.height);
    expect(Math.round(listBox.x)).toBe(Math.round(phoneBox.x));
    expect(listBox.width).toBeGreaterThanOrEqual(phoneBox.width - 1);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(list).toBeHidden();
    await expect(page.locator('input[name="customer.name"]')).toHaveValue("Shahnoza Abdullayeva");
    await expect(page.locator('[id="customer.region_id"]')).toHaveValue("Toshkent shahri • 1726");
    await expect(page.locator('[id="customer.district_id"]')).toHaveValue("Chilonzor • 1726269");
    await expect(page.getByText("Mavjud mijoz", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Bu mijozda yangi buyurtma bor" })).toBeVisible();

    await page.getByRole("list", { name: /katalogi$/ }).getByRole("button", { name: /Telefon ushlagich/ }).click();
    await page.getByPlaceholder("0", { exact: true }).fill("150000");
    await page.getByRole("button", { name: "Buyurtma yaratish" }).click();

    await expect.poll(() => createdOrders.length).toBe(1);
    expect(createdOrders[0]).toMatchObject({ customer_id: "55", district_id: "101", region_id: "11" });
    expect(leaked).toEqual([]);
  });
});
