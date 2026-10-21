import { expect, test } from "@playwright/test";
import {
  MARKET_TARIFFS,
  mainHorizontalOverflow,
  mockOrderCreateApi,
  openManualCreate,
  PRICED_PRODUCTS,
} from "./support/orderCreate";

/**
 * CS-B — 2-QADAM: STANDART NARX, MAHSULOT RASMI, NARX MATNI, «UMUMIY SUMMA» TAKLIFI (1440px, market roli).
 * Maket: `market-new-orders-create-manual-existing-customer` (yetkazish kartalari, tanlangan mahsulotlar, xulosa).
 */
test.describe("Buyurtma yaratish — standart narx va summa taklifi (CS-B), 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("standart narx, sukut tur, rasm, narx matni, summa taklifi va «Qo'llash»; payload", async ({ page }) => {
    const { leaked, createdOrders } = await mockOrderCreateApi(page, {
      profile: MARKET_TARIFFS,
      products: PRICED_PRODUCTS,
    });
    await openManualCreate(page);

    // 1) Yetkazish turi kartalarida standart narx; sukut — `default_tariff` (Uygacha).
    const delivery = page.getByRole("group", { name: /Yetkazish turi/ });
    const center = delivery.locator("label").filter({ hasText: "Markazgacha" });
    const home = delivery.locator("label").filter({ hasText: "Uygacha" });
    await expect(home).toContainText("35 000 so'm");
    await expect(center).toContainText("25 000 so'm");
    await expect(center).toContainText("standart");
    await expect(delivery.getByRole("radio", { name: /Uygacha/ })).toBeChecked();
    await expect(delivery).toContainText("Sizning standart narxingiz. Sukut bo'yicha: Uygacha");
    // Narx va nom bir qatorda — narx kartaning o'ng chetida.
    const homeBox = (await home.boundingBox())!;
    const homePrice = (await home.getByText("35 000 so'm").boundingBox())!;
    expect(homePrice.x + homePrice.width).toBeGreaterThan(homeBox.x + homeBox.width - 24);

    const summary = page.getByRole("complementary", { name: "Buyurtma xulosasi" });
    const deliveryPrice = summary.getByRole("group", { name: "Yetkazish narxi" });
    await expect(deliveryPrice).toContainText("35 000 so'm");
    await expect(deliveryPrice).toContainText("Sizdan yechiladi · yakuniy narx sotuvda qotiriladi");

    // Qo'lda tanlangan tur saqlanadi.
    await center.click();
    await expect(deliveryPrice).toContainText("25 000 so'm");

    // 2) Katalog: rasm 40px (rasm yuklanadi), narxsiz mahsulotda ikonka.
    const catalog = page.getByRole("list", { name: /katalogi$/ });
    const holder = catalog.getByRole("button", { name: /Telefon ushlagich/ });
    const thumb = holder.locator("[data-product-thumb]");
    await expect(thumb).toHaveAttribute("data-product-thumb", "image");
    expect(await thumb.evaluate((el) => (el.querySelector("img") as HTMLImageElement).naturalWidth)).toBe(1);
    const thumbBox = (await thumb.boundingBox())!;
    expect(Math.round(thumbBox.width)).toBe(40);
    expect(Math.round(thumbBox.height)).toBe(40);

    // 3) Summa avtomatik, narx matni.
    const total = page.locator('input[name="details.total_price"]');
    await holder.click();
    await holder.click();
    await catalog.getByRole("button", { name: /USB-C kabel/ }).click();
    await expect(total).toHaveValue("90 000");
    await expect(summary).toContainText("Mahsulotlar narxidan hisoblandi — o'zgartirish mumkin. Narxsiz 1 ta mahsulot hisobga kirmadi");
    const selected = page.getByRole("list", { name: "Tanlangan mahsulotlar" });
    await expect(selected.getByRole("listitem").nth(0)).toContainText("2 × 45 000 so'm");
    await expect(selected.getByRole("listitem").nth(1)).toContainText("Narxi kiritilmagan");

    // 4) Qo'lda yozilgach ustidan yozilmaydi; «Qo'llash» taklifni qo'yadi.
    await total.fill("100000");
    await catalog.getByRole("button", { name: /Avto changyutgich/ }).click();
    await expect(total).toHaveValue("100 000");
    await expect(summary).toContainText("Mahsulotlar bo'yicha:");
    await summary.getByRole("button", { name: "Mahsulotlar bo'yicha summani qo'llash: 210 000 so'm" }).click();
    await expect(total).toHaveValue("210 000");

    // 5) Yaratish — payload: summa va tanlangan tur; forma holati maydonlari ketmaydi.
    await page.getByRole("combobox", { name: /^Telefon/ }).click();
    await page.keyboard.type("901234567");
    await page.locator('input[name="customer.name"]').fill("Aliyev Vali");
    await page.locator('[id="customer.region_id"]').click();
    await page.getByRole("option", { name: /Toshkent shahri/ }).click();
    await page.locator('[id="customer.district_id"]').click();
    await page.getByRole("option", { name: /Chilonzor/ }).click();
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    await summary.getByRole("button", { name: "Buyurtma yaratish" }).click();

    await expect.poll(() => createdOrders.length).toBe(1);
    expect(createdOrders[0]).toMatchObject({ total_price: 210000, where_deliver: "center" });
    expect(createdOrders[0]).not.toHaveProperty("totalPriceAuto");
    expect(createdOrders[0]).not.toHaveProperty("deliveryTypeTouched");
    // Yangi buyurtma uchun forma qayta sukutga: Uygacha, summa bo'sh.
    await expect(delivery.getByRole("radio", { name: /Uygacha/ })).toBeChecked();
    await expect(total).toHaveValue("");
    expect(leaked).toEqual([]);
  });

  test("standart narxsiz market — «Narx yo'q» va ogohlantirish", async ({ page }) => {
    const { leaked } = await mockOrderCreateApi(page, {
      profile: { tariff_home: null, tariff_center: null, default_tariff: null },
      products: PRICED_PRODUCTS,
    });
    await openManualCreate(page);

    const delivery = page.getByRole("group", { name: /Yetkazish turi/ });
    await expect(delivery.locator("label").filter({ hasText: "Markazgacha" })).toContainText("Narx yo'q");
    await expect(delivery.locator("label").filter({ hasText: "Uygacha" })).toContainText("Narx yo'q");
    await expect(page.getByText("Standart narxingiz belgilanmagan")).toBeVisible();
    const summary = page.getByRole("complementary", { name: "Buyurtma xulosasi" });
    await expect(summary.getByRole("group", { name: "Yetkazish narxi" })).toContainText("Narx yo'q");
    expect(leaked).toEqual([]);
  });
});
