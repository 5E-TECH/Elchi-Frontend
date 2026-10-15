import { expect, test, type Page } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_96 } from "./support/orderDetail";

/**
 * SOTISH / BEKOR QILISH tugmalari — hududiy menejer, detal sahifa.
 * Backend (sellOrder / cancelOrder / partlySellOrder) faqat status === WAITING
 * va post_id bor buyurtmani qabul qiladi — tugma ham faqat shunda chiqadi.
 */
const REGIONAL_MANAGER = {
  id: "501",
  role: "manager",
  name: "Hududiy menejer",
  status: "active",
  branch_id: "12",
  branch: { id: "12", name: "Urganch filiali", type: "REGIONAL" },
};

// Filialda turgan buyurtma (kuryer qo'lida emas) — LC-04 qoidasi aralashmasin.
const baseOrder = { ...ORDER_96, holder_type: "BRANCH", holder_branch_id: "12", holder_courier_id: null, courier_id: null };

const actionButtons = (page: Page) =>
  page.locator("button").filter({ hasText: /^(Sotish|Bekor qilish)$/ });

test.describe("Sotish/Bekor qilish — hududiy menejer", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  for (const status of ["new", "received", "on the road"]) {
    test(`${status} (post_id bor) — tugmalar YO'Q`, async ({ page }) => {
      const { leaked } = await mockOrderDetailApi(page, { ...baseOrder, status }, { profile: REGIONAL_MANAGER });
      await openOrderDetail(page);
      await expect(actionButtons(page)).toHaveCount(0);
      expect(leaked).toEqual([]);
    });
  }

  test("waiting, lekin post_id=null — tugmalar YO'Q", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(
      page,
      { ...baseOrder, status: "waiting", post_id: null },
      { profile: REGIONAL_MANAGER },
    );
    await openOrderDetail(page);
    await expect(actionButtons(page)).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ waiting + post_id — tugmalar bor, Sotish muvaffaqiyatli o'tadi", async ({ page }) => {
    const order: Record<string, unknown> = { ...baseOrder, status: "waiting", post_id: "90" };
    const { leaked, writes } = await mockOrderDetailApi(page, order, {
      profile: REGIONAL_MANAGER,
      onWrite: (method, path) => {
        if (method !== "POST" || path !== `orders/sell/${order.id}`) return undefined;
        // Backend sotilgan buyurtmani qaytaradi — keyingi GET ham yangi holatni ko'radi.
        order.status = "sold";
        return { statusCode: 200, message: "ok", data: { ...order } };
      },
    });
    await openOrderDetail(page);

    await expect(actionButtons(page)).toHaveText(["Sotish", "Bekor qilish"]);
    await actionButtons(page).filter({ hasText: "Sotish" }).click();

    const submit = page.locator("button").filter({ hasText: /^Sotish$/ }).last();
    await expect(submit).toBeEnabled();
    const sellRequest = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith(`/orders/sell/${order.id}`),
    );
    await submit.click();
    await sellRequest;

    // Oyna yopildi, holat "Sotilgan", tugmalar yo'qoldi.
    await expect(actionButtons(page)).toHaveCount(0);
    await expect(page.getByText("Sotilgan").first()).toBeVisible();
    expect(writes).toEqual([`POST orders/sell/${order.id}`]);
    expect(leaked).toEqual([]);
  });
});
