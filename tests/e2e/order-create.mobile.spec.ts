import { expect, test } from "@playwright/test";
import {
  gridOf,
  mainHorizontalOverflow,
  measureGrid,
  mockOrderCreateApi,
  openManualCreate,
  SUGGESTED_CUSTOMER,
} from "./support/orderCreate";
import { expectToast } from "./support/toast";

/**
 * QO'LDA BUYURTMA YARATISH (Step2Combined) — 390px TELEFON, dizayn v2.
 *
 * Regressiya: `Field` ning `wide` varianti prefikssiz `col-span-2` olganda
 * telefondagi bitta ustunli gridda CSS Grid YASHIRIN ikkinchi ustun yaratardi
 * (`grid-template-columns: 37px 247px`): ISM inputi 37px, TELEFON 70px, yetkazish turi
 * 77px. Bundan tashqari `+998` prefiksi bosishni ushlab qolib, telefon maydonini
 * bosib bo'lmasdi. Kuryer va marketlar telefondan buyurtma yarata olmasdi.
 *
 * Piksel-skrinshot EMAS, geometriya tekshiriladi: skrinshot mashinadan mashinaga
 * (shrift, render) farq qilib soxta yiqiladi, o'lchovlar esa aynan shu xatoni tutadi.
 */

test.describe("Qo'lda buyurtma yaratish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("mijoz va manzil bloklari BITTA ustunli, ISM va TELEFON kamida 280px", async ({ page }) => {
    const { leaked } = await mockOrderCreateApi(page);
    await openManualCreate(page);

    for (const anchor of ['input[name="customer.name"]', 'textarea[name="details.comment"]']) {
      const grid = await measureGrid(gridOf(page.locator(anchor)));
      // Bitta ustun ("296px" kabi) — yashirin ikkinchi ustun ("37px 247px") emas.
      expect(grid.columns.filter((column) => parseFloat(column) > 0), anchor).toHaveLength(1);
      expect(parseFloat(grid.columns[0]), anchor).toBeGreaterThanOrEqual(280);
      for (const width of grid.children) {
        expect(width, `${anchor}: grid bolasi`).toBeGreaterThanOrEqual(grid.content - 1);
      }
    }

    // Avval 37px va 70px edi.
    const fields = {
      ISM: page.locator('input[name="customer.name"]'),
      TELEFON: page.getByPlaceholder("XX XXX XX XX").first(),
      "QO'SHIMCHA TELEFON": page.getByPlaceholder("XX XXX XX XX").nth(1),
    };
    for (const [label, field] of Object.entries(fields)) {
      // Telefon maydoni qutisi (+998 prefiksi bilan) — to'liq qator.
      const box = await field.locator("xpath=ancestor::div[@data-text-input][1]").boundingBox();
      expect(box!.width, label).toBeGreaterThanOrEqual(280);
    }

    // «Markazgacha» / «Uygacha» — har biri to'liq qator, kamida 44px balandlik (avval 77px kenglik).
    const delivery = page.getByRole("group", { name: /Yetkazish turi/ });
    for (const name of ["Markazgacha", "Uygacha"]) {
      const box = await delivery.locator("label").filter({ hasText: name }).boundingBox();
      expect(box!.width, name).toBeGreaterThanOrEqual(280);
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
    }

    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("telefon inputining MARKAZIGA va +998 prefiksiga bosganda input fokus oladi", async ({ page }) => {
    const { leaked } = await mockOrderCreateApi(page);
    await openManualCreate(page);

    const phones = page.getByPlaceholder("XX XXX XX XX");
    for (const index of [0, 1]) {
      const input = phones.nth(index);
      const prefix = input.locator("xpath=ancestor::div[@data-text-input][1]").getByText("+998", { exact: true });
      await expect(prefix).toBeVisible();

      // 1) Inputning aynan MARKAZIGA — haqiqiy sichqoncha bosishi (force yo'q).
      const box = await input.boundingBox();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(input).toBeFocused();
      // Markazdagi nuqtada eng ustki element — inputning o'zi (prefiks ushlamaydi).
      const topAtCenter = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("placeholder"),
        { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
      );
      expect(topAtCenter).toBe("XX XXX XX XX");

      // 2) Aynan +998 prefiksi USTIGA (avval span bosishni ushlab qolardi).
      await page.locator("body").click({ position: { x: 5, y: 5 } });
      const prefixBox = await prefix.boundingBox();
      await page.mouse.click(prefixBox!.x + prefixBox!.width / 2, prefixBox!.y + prefixBox!.height / 2);
      await expect(input).toBeFocused();

      await page.keyboard.type("901234567");
      await expect(input).toHaveValue("90 123 45 67");
    }

    expect(leaked).toEqual([]);
  });

  test("telefondan TO'LIQ buyurtma yaratiladi: telefon, ism, viloyat, tuman, mahsulot, summa", async ({ page }) => {
    const { leaked, createdOrders } = await mockOrderCreateApi(page);
    await openManualCreate(page);

    await page.getByPlaceholder("XX XXX XX XX").first().click();
    await page.keyboard.type("901234567");
    await page.locator('input[name="customer.name"]').fill("Aliyev Vali");

    // Viloyat/tuman — v2 `Select` (combobox + portaldagi listbox): variantlar `option` roli bilan.
    await page.locator('[id="customer.region_id"]').click();
    await page.getByRole("listbox", { name: /Viloyat/ }).getByRole("option", { name: "Toshkent shahri • 1726" }).click();
    await expect(page.locator('[id="customer.district_id"]')).toBeEnabled();
    await page.locator('[id="customer.district_id"]').click();
    await page.getByRole("listbox", { name: /Tuman/ }).getByRole("option", { name: "Chilonzor • 1726269" }).click();

    await page.locator('textarea[name="customer.address"]').fill("Chilonzor 19-kvartal, 45-uy");
    await page.getByRole("list", { name: /katalogi$/ }).getByRole("button", { name: /Telefon ushlagich/ }).click();
    // Yetkazish turi — radio-karta: yorliqning o'ziga teginiladi.
    await page.getByRole("group", { name: /Yetkazish turi/ }).locator("label").filter({ hasText: "Markazgacha" }).click();
    await expect(page.getByRole("radio", { name: /Markazgacha/ })).toBeChecked();
    await page.getByPlaceholder("0", { exact: true }).fill("150000");

    // Hamma narsa 390px da ham yig'ilib qolmasdan ko'rinadi.
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);

    const submit = page.getByRole("button", { name: "Buyurtma yaratish" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => createdOrders.length).toBe(1);
    expect(createdOrders[0]).toEqual({
      customer: {
        name: "Aliyev Vali",
        phone_number: "+998901234567",
        district_id: "101",
        address: "Chilonzor 19-kvartal, 45-uy",
      },
      items: [{ product_id: "501", quantity: 1 }],
      district_id: "101",
      region_id: "11",
      total_price: 150000,
      where_deliver: "center",
      address: "Chilonzor 19-kvartal, 45-uy",
    });

    // v2 Toaster: matn ko'rinadigan kartada VA yashirin e'londa — karta (muvaffaqiyat toni) tekshiriladi.
    await expectToast(page, "Muvaffaqiyatli", { tone: "success" });
    // Forma keyingi buyurtma uchun tozalanadi.
    await expect(page.locator('input[name="customer.name"]')).toHaveValue("");

    expect(leaked).toEqual([]);
  });

  test("CS-A: mavjud mijoz — telefonda «Mijozni tanlang» varaqasi, maydonlar to'ladi, `customer_id` yuboriladi", async ({ page }) => {
    const { leaked, createdOrders, suggestQueries } = await mockOrderCreateApi(page, { suggestions: [SUGGESTED_CUSTOMER] });
    await openManualCreate(page);

    await page.getByPlaceholder("XX XXX XX XX").first().click();
    await page.keyboard.type("9034567");

    const sheet = page.getByRole("dialog", { name: "Mijozni tanlang" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("+998 90 345 67 · 1 ta mos keldi");
    // Market rolida `market_id` yuborilmaydi (backend tokendan oladi).
    expect(suggestQueries.at(-1)).toEqual({ phone: "9034567" });
    // Pastki varaqa: ekranning pastki chetiga yopishgan, to'liq enli.
    const box = (await sheet.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(viewport.width - 1);

    const option = sheet.getByRole("option", { name: /Shahnoza Abdullayeva/ });
    expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await option.click();
    await expect(sheet).toBeHidden();

    await expect(page.locator('input[name="customer.name"]')).toHaveValue("Shahnoza Abdullayeva");
    await expect(page.getByPlaceholder("XX XXX XX XX").first()).toHaveValue("90 345 67 21");
    await expect(page.locator('[id="customer.district_id"]')).toHaveValue("Chilonzor • 1726269");
    await expect(page.getByText("Mavjud mijoz", { exact: true })).toBeVisible();
    const alert = page.getByRole("alert").filter({ hasText: "Bu mijozda yangi buyurtma bor" });
    await expect(alert.getByRole("link", { name: "Buyurtma №10260 ni yangi oynada ochish" })).toHaveAttribute(
      "href",
      "/new-orders/7/edit/10260",
    );
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole("list", { name: /katalogi$/ }).getByRole("button", { name: /Telefon ushlagich/ }).click();
    await page.getByPlaceholder("0", { exact: true }).fill("150000");
    await page.getByRole("button", { name: "Buyurtma yaratish" }).click();

    await expect.poll(() => createdOrders.length).toBe(1);
    expect(createdOrders[0]).toMatchObject({
      customer_id: "55",
      customer: { name: "Shahnoza Abdullayeva", phone_number: "+998903456721", district_id: "101" },
      district_id: "101",
      region_id: "11",
    });
    expect(leaked).toEqual([]);
  });
});
