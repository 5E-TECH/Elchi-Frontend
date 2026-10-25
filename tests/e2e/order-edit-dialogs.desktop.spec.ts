import { expect, test, type Page, type Route } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_96 } from "./support/orderDetail";
import { expectToast } from "./support/toast";

/**
 * BUYURTMA TAFSILOTI — TAHRIRLASH OYNALARI (dizayn v2: `*-orders-detail-edit-*-dialog`).
 * Haqiqiy sahifa + soxta backend: oyna ochiladi, maydonlar joriy qiymat bilan, saqlash
 * `PATCH /orders/:id/full` (manzil, buyurtma) yoki `PATCH /users/:id` (mijoz) ga FAQAT o'zgargan
 * maydonlarni yuboradi, natija xabari chiqadi va oyna yopiladi.
 */

const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

/** Yangi (HQ qabul qilmagan) buyurtma: hamma narsa tahrirlanadi. */
const NEW_ORDER = {
  ...ORDER_96,
  status: "new",
  post_id: null,
  courier_id: null,
  holder_type: "HQ",
  holder_courier_id: null,
  parent_order_id: null,
  total_price: "150000.00",
  comment: "Oldin qo'ng'iroq qiling",
  district_id: "d1",
  district: { id: "d1", name: "Chilonzor tumani", region_id: "r1", region: { id: "r1", name: "Toshkent shahri" } },
  items: [
    { id: "i1", quantity: 1, product_id: "p1", product: { id: "p1", name: "Smartfon A15, 128 GB" } },
    { id: "i2", quantity: 2, product_id: "p2", product: { id: "p2", name: "Himoya g'ilofi" } },
  ],
};

const REGIONS = [
  { id: "r1", name: "Toshkent shahri" },
  { id: "r2", name: "Samarqand viloyati" },
];
const DISTRICTS: Record<string, { id: string; name: string }[]> = {
  r1: [
    { id: "d1", name: "Chilonzor tumani" },
    { id: "d2", name: "Yunusobod tumani" },
  ],
  r2: [
    { id: "d3", name: "Samarqand shahri" },
    { id: "d4", name: "Urgut tumani" },
  ],
};

/**
 * Viloyat/tuman ro'yxatlari va tahrirlash so'rovlari (tanasi bilan) — `mockOrderDetailApi` ustidan
 * (keyin ro'yxatdan o'tgan route ustun turadi).
 */
const mockEditApi = async (page: Page) => {
  const patches: { path: string; body: unknown }[] = [];
  await page.context().route(/\/(region(\/\w+)?|orders\/\w+\/full|users\/\w+)(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    if (request.method() === "PATCH") {
      patches.push({ path, body: request.postDataJSON() });
      return reply(route, { statusCode: 200, message: "ok", data: {} });
    }
    if (path === "region") return reply(route, { statusCode: 200, data: REGIONS });
    const regionId = path.match(/^region\/(\w+)$/)?.[1];
    if (regionId) return reply(route, { statusCode: 200, data: { id: regionId, districts: DISTRICTS[regionId] ?? [] } });
    return route.fallback();
  });
  return patches;
};

test.describe("Buyurtma tafsiloti — tahrirlash oynalari (admin)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ manzil: viloyat almashsa tuman qayta tanlanadi; faqat o'zgarganlar yuboriladi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, NEW_ORDER);
    const patches = await mockEditApi(page);
    await openOrderDetail(page);

    await page.getByRole("button", { name: "Manzilni tahrirlash" }).click();
    const dialog = page.getByRole("dialog", { name: "Manzilni tahrirlash" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("№96 · Aliyev Vali");
    const region = dialog.getByRole("combobox", { name: /^Viloyat/ });
    const district = dialog.getByRole("combobox", { name: /^Tuman/ });
    await expect(region).toHaveText("Toshkent shahri");
    await expect(district).toHaveText("Chilonzor tumani");

    await region.click();
    await page.getByRole("option", { name: "Samarqand viloyati" }).click();
    await expect(district).toHaveText("Tumanni tanlang");
    await expect(dialog.getByText("Viloyat o'zgargani uchun tumanni qayta tanlang.")).toBeVisible();

    // Tumansiz saqlanmaydi — xato maydon ostida, so'rov ketmaydi.
    await dialog.getByRole("button", { name: "Saqlash" }).click();
    await expect(district).toHaveAttribute("aria-invalid", "true");
    expect(patches).toEqual([]);

    await district.click();
    await page.getByRole("option", { name: "Urgut tumani" }).click();
    await dialog.getByRole("button", { name: "Saqlash" }).click();

    await expectToast(page, "Manzil saqlandi", { tone: "success" });
    await expect(dialog).toBeHidden();
    expect(patches).toEqual([{ path: "orders/96/full", body: { region_id: "r2", district_id: "d4" } }]);
    expect(leaked).toEqual([]);
  });

  test("⭐ mijoz: telefon +998 bilan, PATCH /users/:id faqat telefon", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, NEW_ORDER);
    const patches = await mockEditApi(page);
    await openOrderDetail(page);

    await page.getByRole("button", { name: "Mijoz ma'lumotini tahrirlash" }).click();
    const dialog = page.getByRole("dialog", { name: "Mijoz ma'lumotini tahrirlash" });
    await expect(dialog).toContainText("№96 · Kimdur Kimdur");
    await expect(dialog.getByLabel(/^Ism/)).toHaveValue("Aliyev Vali");
    const phone = dialog.getByLabel(/^Telefon/);
    await expect(phone).toHaveValue("90 123 45 67");

    await phone.fill("91 765 43 21");
    await dialog.getByRole("button", { name: "Saqlash" }).click();

    await expectToast(page, "Mijoz ma'lumoti saqlandi", { tone: "success" });
    await expect(dialog).toBeHidden();
    expect(patches).toEqual([{ path: "users/c1", body: { phone_number: "+998917654321" } }]);
    expect(leaked).toEqual([]);
  });

  test("⭐ buyurtma: summa «150000.00» → «150 000»; son va izoh o'zgarsa faqat ular yuboriladi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, NEW_ORDER);
    const patches = await mockEditApi(page);
    await openOrderDetail(page);

    await page.getByRole("button", { name: "Buyurtmani tahrirlash" }).click();
    const dialog = page.getByRole("dialog", { name: "Buyurtmani tahrirlash" });
    await expect(dialog.getByLabel(/^Umumiy summa/)).toHaveValue("150 000");
    await expect(dialog.getByRole("combobox", { name: "Yetkazish turi" })).toHaveText("Uygacha");

    await dialog.getByRole("button", { name: "Himoya g'ilofi sonini oshirish" }).click();
    await expect(dialog.getByRole("group", { name: "Himoya g'ilofi soni" })).toContainText("3");
    await dialog.getByLabel("Izoh").fill("Domofon 32");
    await dialog.getByRole("button", { name: "Saqlash" }).click();

    await expectToast(page, "Buyurtma saqlandi", { tone: "success" });
    await expect(dialog).toBeHidden();
    expect(patches).toEqual([
      {
        path: "orders/96/full",
        body: {
          comment: "Domofon 32",
          items: [
            { product_id: "p1", quantity: 1 },
            { product_id: "p2", quantity: 3 },
          ],
        },
      },
    ]);
    expect(leaked).toEqual([]);
  });
});
