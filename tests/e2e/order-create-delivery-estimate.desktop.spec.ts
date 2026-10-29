import { expect, test } from "@playwright/test";
import {
  fakeDeliveryQuote,
  MARKET_TARIFFS,
  MEASURED_PRODUCTS,
  mockOrderCreateApi,
  openManualCreate,
} from "./support/orderCreate";

/**
 * 6NYcXvGy — buyurtma formasida TAXMINIY yetkazish narxi (1440px, market roli). Maket
 * `market-new-orders-create-manual-existing-customer` → «Buyurtma xulosasi» → «Yetkazish narxi ≈ …». Narxni server
 * hisoblaydi (`POST delivery/quote/by-tariff`, soxta dvigatel — sayt formulasi), forma faqat ko'rsatadi: har dona
 * alohida element, ~400 ms kutish, o'lchovsiz mahsulot ogohlantirishi, narx payload'ga qo'shilmaydi.
 */
test.describe("Buyurtma yaratish — taxminiy yetkazish narxi (6NYcXvGy), 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("narx, hisob vazni, debounce, o'lchovsiz mahsulot, tur almashishi; payload'da narx yo'q", async ({
    page,
  }) => {
    const { leaked, createdOrders, quoteRequests } = await mockOrderCreateApi(page, {
      profile: MARKET_TARIFFS,
      products: MEASURED_PRODUCTS,
      quote: fakeDeliveryQuote,
    });
    await openManualCreate(page);

    const summary = page.getByRole("complementary", { name: "Buyurtma xulosasi" });
    const price = summary.getByRole("group", { name: "Yetkazish narxi" });
    const estimate = price.getByTestId("delivery-estimate");
    // Mahsulot tanlanmagan — avvalgidek standart narx (CS-B), so'rov yo'q.
    await expect(price).toContainText("35 000 so'm");
    await expect(price).toContainText("Standart narx");
    expect(quoteRequests).toHaveLength(0);

    // 1) Bitta o'lchovli mahsulot: 1,2 kg, 30×22×15 → hajmli 1,98 → hisob 2,0 kg → 1 qo'shimcha kg → 39 000.
    const catalog = page.getByRole("list", { name: /katalogi$/ });
    const thermos = catalog.getByRole("button", { name: /Termos/ });
    await thermos.click();
    await expect(estimate).toHaveText("≈ 39 000 so'm");
    await expect(price).toContainText("Standart 35 000 + vazn uchun 4 000 so'm (1 kg × 4 000)");
    await expect(price).toContainText("Hisob vazni 2,0 kg · hajm bo'yicha");
    await expect(price).toContainText("Og'irligi 1,2 kg · hajmli vazni 1,98 kg");
    await expect(price).toContainText("Sizdan yechiladi · yakuniy narx sotuvda qotiriladi");
    await expect(price.getByText("Taxminiy", { exact: true })).toBeVisible();
    expect(quoteRequests).toHaveLength(1);
    expect(quoteRequests[0].items).toEqual([
      { weight_kg: 1.2, length_cm: 30, width_cm: 22, height_cm: 15, volumetric_enabled: true },
    ]);

    // 2) Debounce: ketma-ket uchta o'zgarish (Termos ×3, Kitob) — bitta so'rov, har dona alohida element. Bosishlar bitta
    // vazifada (sekin CI'da ham 400 ms kutish ichida).
    const thermosEl = await thermos.elementHandle();
    const bookEl = await catalog.getByRole("button", { name: /Kitob/ }).elementHandle();
    await page.evaluate(
      ([first, second]) => {
        (first as HTMLElement).click();
        (first as HTMLElement).click();
        (second as HTMLElement).click();
      },
      [thermosEl, bookEl],
    );
    // 3,6 + 0,5 = 4,1 kg; hajmli 5,94 + 0,168 = 6,108 → hisob 6,2 kg → 6 qo'shimcha kg → 35 000 + 24 000.
    await expect(estimate).toHaveText("≈ 59 000 so'm");
    expect(quoteRequests).toHaveLength(2);
    expect(quoteRequests[1].items).toHaveLength(4);

    // 3) O'lchovsiz mahsulot — nomi bilan izoh (maket), narx o'zgarmaydi va yangi so'rov ketmaydi.
    await catalog.getByRole("button", { name: /Eski mahsulot/ }).click();
    await expect(price.getByRole("status")).toHaveText(
      "«Eski mahsulot» o'lchovi kiritilmagan — vazni hisobga kirmadi",
    );
    await expect(estimate).toHaveText("≈ 59 000 so'm");

    // 4) «Markazgacha» — o'sha javobdan `center` (25 000 + 24 000), so'rovsiz.
    await page
      .getByRole("group", { name: /Yetkazish turi/ })
      .locator("label")
      .filter({ hasText: "Markazgacha" })
      .click();
    await expect(estimate).toHaveText("≈ 49 000 so'm");
    await page.waitForTimeout(700);
    expect(quoteRequests).toHaveLength(2);

    // 5) Yaratish — payload'da yetkazish narxi YO'Q (backend DTO uni qabul qilmaydi).
    await page.getByRole("combobox", { name: /^Telefon/ }).click();
    await page.keyboard.type("901234567");
    await page.locator('input[name="customer.name"]').fill("Aliyev Vali");
    await page.locator('[id="customer.region_id"]').click();
    await page.getByRole("option", { name: /Toshkent shahri/ }).click();
    await page.locator('[id="customer.district_id"]').click();
    await page.getByRole("option", { name: /Chilonzor/ }).click();
    await summary.getByRole("button", { name: "Buyurtma yaratish" }).click();
    await expect.poll(() => createdOrders.length).toBe(1);
    expect(createdOrders[0]).toMatchObject({ where_deliver: "center" });
    expect(JSON.stringify(createdOrders[0])).not.toMatch(
      /quote|estimate|delivery_price|billable|tariff|weight/i,
    );
    expect(leaked).toEqual([]);
  });

  test("API javob bermadi — «Hisoblab bo'lmadi», forma ishlaydi; «Qayta urinish» — narx chiqadi", async ({
    page,
  }) => {
    let calls = 0;
    const { leaked } = await mockOrderCreateApi(page, {
      profile: MARKET_TARIFFS,
      products: MEASURED_PRODUCTS,
      quote: (body) => {
        calls += 1;
        return calls === 1
          ? { status: 503, body: { message: "Service Unavailable" } }
          : fakeDeliveryQuote(body);
      },
    });
    await openManualCreate(page);

    const summary = page.getByRole("complementary", { name: "Buyurtma xulosasi" });
    const price = summary.getByRole("group", { name: "Yetkazish narxi" });
    await page
      .getByRole("list", { name: /katalogi$/ })
      .getByRole("button", { name: /Termos/ })
      .click();
    // Maket «hisoblab bo'lmadi»: hozircha market standart narxi, sabab va «Qayta urinish».
    await expect(price.getByTestId("delivery-estimate")).toHaveText("35 000 so'm");
    await expect(price.getByRole("alert")).toHaveText(
      "Vazn bo'yicha qo'shimchani hisoblab bo'lmadi — hozircha standart narx. Buyurtmani baribir yaratish mumkin.",
    );
    // Forma ishlayveradi: summa va «Buyurtma yaratish» joyida, xato toast'i yo'q (blok o'zi aytadi).
    await expect(page.locator('input[name="details.total_price"]')).toHaveValue("45 000");
    await expect(summary.getByRole("button", { name: "Buyurtma yaratish" })).toBeVisible();

    await price.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(price.getByTestId("delivery-estimate")).toHaveText("≈ 39 000 so'm");
    expect(leaked).toEqual([]);
  });
});
