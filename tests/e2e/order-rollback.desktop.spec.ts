import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_95 } from "./support/orderDetail";

/**
 * y2RarzlT — superadmin buyurtma tafsilotida «Qaytarish» (backend: sotilgan, bekor, yopilgan, to'langan, qisman
 * to'langan); oynada maqsad holat tanlovi («Kutilmoqda» / «Bekor qilish») va `target_status` POST body'da;
 * qaytarilgach buyurtma qayta o'qiladi (holat yangilanadi). 1440px, soxta backend.
 * BE #738: `GET /orders/:id` da `rollback` maydoni (superadmin uchun — sotuv holatlarida `allowed: true`, qolganida
 * `STATUS_NOT_ROLLBACKABLE`); maydonsiz (eski backend / `null`) — avvalgi holat qoidasi; oynada daftar izohi.
 */
const SUPERADMIN = { id: "1", role: "superadmin", name: "E2E superadmin", status: "active" };

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

const ALLOWED = { allowed: true, code: null, message: null };
const notRollbackable = (status: string) => ({
  allowed: false,
  code: "STATUS_NOT_ROLLBACKABLE",
  message: `Rollback mumkin emas (status: ${status})`,
});

for (const [status, visible] of [
  ["sold", true],
  ["paid", true],
  ["partly_paid", true],
  ["new", false],
  ["received", false],
  ["waiting", false],
] as const) {
  test(`⭐ superadmin, ${status}: «Qaytarish» tugmasi ${visible ? "bor" : "yo'q"} (server maydoni)`, async ({ page }) => {
    const rollback = visible ? ALLOWED : notRollbackable(status);
    await mockOrderDetailApi(page, { ...ORDER_95, status, rollback }, { profile: SUPERADMIN });
    await openOrderDetail(page, "95");
    await expect(page.getByRole("button", { name: "Qaytarish", exact: true })).toHaveCount(visible ? 1 : 0);
    // «Jim» kod (holat qaytarilmaydi) — sabab izohi yo'q.
    await expect(page.getByTestId("rollback-blocked-reason")).toHaveCount(0);
  });
}

for (const [status, visible] of [
  ["sold", true],
  ["waiting", false],
] as const) {
  test(`superadmin, ${status}, \`rollback: null\` (noma'lum) — zaxira: tugma ${visible ? "bor" : "yo'q"}`, async ({ page }) => {
    await mockOrderDetailApi(page, { ...ORDER_95, status, rollback: null }, { profile: SUPERADMIN });
    await openOrderDetail(page, "95");
    await expect(page.getByRole("button", { name: "Qaytarish", exact: true })).toHaveCount(visible ? 1 : 0);
  });
}

test("superadmin, `CORRECTION_REQUIRED`: tugma yo'q, «Qaytarish yopiq.» va server yo'l-yo'rig'i", async ({ page }) => {
  const message =
    "Bu buyurtmada qo'shimcha xarajat krediti (manfiy (kredit) summa) bor va kuryer pulni filialga topshirib bo'lgan — " +
    "avtomatik qaytarib bo'lmaydi. Superadmin: Moliya → kuryer to'lovlari tarixida shu topshiriqni qaytaring yoki " +
    "tahrirlang (T6); shundan keyin buyurtmani qaytarish mumkin bo'ladi";
  await mockOrderDetailApi(
    page,
    { ...ORDER_95, rollback: { allowed: false, code: "CORRECTION_REQUIRED", message } },
    { profile: SUPERADMIN },
  );
  await openOrderDetail(page, "95");
  await expect(page.getByRole("button", { name: "Qaytarish", exact: true })).toHaveCount(0);
  const note = page.getByTestId("rollback-blocked-reason");
  await expect(note).toContainText("Qaytarish yopiq.");
  await expect(note).toContainText("Moliya → kuryer to'lovlari tarixida shu topshiriqni qaytaring");
});

test("⭐ superadmin /orders/edit/95 (sotilgan): «Bekor qilish» → POST { target_status: cancelled }, holat yangilanadi", async ({ page }) => {
  const order: Record<string, unknown> = { ...ORDER_95, rollback: ALLOWED };
  const bodies: unknown[] = [];
  const { requests, leaked } = await mockOrderDetailApi(page, order, {
    profile: SUPERADMIN,
    onWrite: (method, path) => {
      if (method !== "POST" || path !== "orders/rollback/95") return undefined;
      order.status = "cancelled";
      order.rollback = ALLOWED;
      return { statusCode: 200, message: "Order CANCELLED holatiga qaytarildi", data: {} };
    },
  });
  const keys: (string | undefined)[] = [];
  await page.route(/\/orders\/rollback\/95$/, (route) => {
    if (route.request().method() === "POST") {
      bodies.push(route.request().postDataJSON());
      keys.push(route.request().headers()["idempotency-key"]);
    }
    return route.fallback();
  });
  await openOrderDetail(page, "95");

  await page.getByRole("button", { name: "Qaytarish", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  await expect(dialog).toBeVisible();
  const choice = dialog.getByRole("radiogroup", { name: "Qaysi holatga qaytariladi" });
  await expect(choice.getByRole("radio")).toHaveText(["Kutilmoqda", "Bekor qilish"]);
  await expect(dialog).toContainText("Buyurtmaning kassa yozuvlari ham qaytariladi.");
  // BE #738 (D2): superadmin oynasida daftar izohi.
  await expect(dialog.getByTestId("rollback-ledger-note")).toContainText("naqd ko'chmaydi");

  const readsBefore = requests.filter((entry) => entry === "GET orders/95").length;
  await choice.getByRole("radio", { name: "Bekor qilish" }).click();
  await expect(dialog).toContainText("Buyurtma «Bekor qilingan» holatiga qaytariladi.");
  await dialog.getByRole("button", { name: "Ha, qaytarish" }).click();

  await expect(dialog).toBeHidden();
  expect(bodies).toEqual([{ target_status: "cancelled" }]);
  expect(keys).toEqual([expect.stringMatching(/\S{8,}/)]);
  // Buyurtma qayta o'qildi — sahifadagi holat «Bekor qilingan».
  await expect.poll(() => requests.filter((entry) => entry === "GET orders/95").length).toBeGreaterThan(readsBefore);
  await expect(page.locator('[data-order-status="cancelled"]').first()).toBeVisible();
  expect(leaked).toEqual([]);
});
