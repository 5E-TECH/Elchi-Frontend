import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_95 } from "./support/orderDetail";

/**
 * y2RarzlT — superadmin buyurtma tafsilotida «Qaytarish» (backend: sotilgan, bekor, yopilgan, to'langan, qisman
 * to'langan); oynada maqsad holat tanlovi («Kutilmoqda» / «Bekor qilish») va `target_status` POST body'da;
 * qaytarilgach buyurtma qayta o'qiladi (holat yangilanadi). 1440px, soxta backend.
 */
const SUPERADMIN = { id: "1", role: "superadmin", name: "E2E superadmin", status: "active" };

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

for (const [status, visible] of [
  ["sold", true],
  ["paid", true],
  ["partly_paid", true],
  ["new", false],
  ["received", false],
  ["waiting", false],
] as const) {
  test(`⭐ superadmin, ${status}: «Qaytarish» tugmasi ${visible ? "bor" : "yo'q"}`, async ({ page }) => {
    await mockOrderDetailApi(page, { ...ORDER_95, status }, { profile: SUPERADMIN });
    await openOrderDetail(page, "95");
    await expect(page.getByRole("button", { name: "Qaytarish", exact: true })).toHaveCount(visible ? 1 : 0);
  });
}

test("⭐ superadmin /orders/edit/95 (sotilgan): «Bekor qilish» → POST { target_status: cancelled }, holat yangilanadi", async ({ page }) => {
  const order: Record<string, unknown> = { ...ORDER_95 };
  const bodies: unknown[] = [];
  const { requests, leaked } = await mockOrderDetailApi(page, order, {
    profile: SUPERADMIN,
    onWrite: (method, path) => {
      if (method !== "POST" || path !== "orders/rollback/95") return undefined;
      order.status = "cancelled";
      return { statusCode: 200, message: "ok", data: { ...order } };
    },
  });
  await page.route(/\/orders\/rollback\/95$/, (route) => {
    if (route.request().method() === "POST") bodies.push(route.request().postDataJSON());
    return route.fallback();
  });
  await openOrderDetail(page, "95");

  await page.getByRole("button", { name: "Qaytarish", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  await expect(dialog).toBeVisible();
  const choice = dialog.getByRole("radiogroup", { name: "Qaysi holatga qaytariladi" });
  await expect(choice.getByRole("radio")).toHaveText(["Kutilmoqda", "Bekor qilish"]);
  await expect(dialog).toContainText("Buyurtmaning kassa yozuvlari ham qaytariladi.");

  const readsBefore = requests.filter((entry) => entry === "GET orders/95").length;
  await choice.getByRole("radio", { name: "Bekor qilish" }).click();
  await expect(dialog).toContainText("Buyurtma «Bekor qilingan» holatiga qaytariladi.");
  await dialog.getByRole("button", { name: "Ha, qaytarish" }).click();

  await expect(dialog).toBeHidden();
  expect(bodies).toEqual([{ target_status: "cancelled" }]);
  // Buyurtma qayta o'qildi — sahifadagi holat «Bekor qilingan».
  await expect.poll(() => requests.filter((entry) => entry === "GET orders/95").length).toBeGreaterThan(readsBefore);
  await expect(page.locator('[data-order-status="cancelled"]').first()).toBeVisible();
  expect(leaked).toEqual([]);
});
