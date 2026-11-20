import { expect, test, type Page } from "@playwright/test";
import {
  ALLOWED,
  markRolledBack,
  mockRollbackApi,
  PARCEL_NOT_IN_BRANCH_MESSAGE,
  rollbackOrder,
  SUPERADMIN_ONLY,
  SUPERADMIN_ONLY_MESSAGE,
} from "./support/orderRollback";
import { toast } from "./support/toast";

/**
 * BE #738 (D1–D4) — menejer, 390px: telefon kartasida «Qaytarish» faqat server `rollback.allowed` dan (44px),
 * oyna pastki varaqa; rad etilgan / «Bekor — jo'natilgan» kartada amal yo'q, sabab tafsilotda; `rollback: null` —
 * zaxira tugma, xato oyna ichida. Gorizontal skroll yo'q.
 */

test.describe.configure({ timeout: 180_000 });

const rows = () => [
  rollbackOrder("10302", "Malika Yusupova", { rollback: ALLOWED }),
  rollbackOrder("10301", "Bekzod Aliyev", { rollback: SUPERADMIN_ONLY }),
  rollbackOrder("10300", "Shahnoza Ergasheva", {
    status: "cancelled",
    transport_status: "cancelled (sent)",
    holder_type: "HQ",
    rollback: { allowed: false, code: "PARCEL_NOT_IN_BRANCH", message: PARCEL_NOT_IN_BRANCH_MESSAGE },
  }),
  rollbackOrder("10298", "Nodira Saidova", { rollback: null }),
];

const openList = async (page: Page) => {
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Malika Yusupova" })).toBeVisible();
};
const cardOf = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

test("⭐ ruxsat bor karta: 44px «Qaytarish» → pastki varaqa → muvaffaqiyat (Idempotency-Key)", async ({ page }) => {
  const { state, leaked } = await mockRollbackApi(page, rows(), { onRolledBack: markRolledBack });
  await openList(page);

  const button = cardOf(page, "Malika Yusupova").getByRole("button", { name: "№10302 ni kutilmoqda holatiga qaytarish" });
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await button.click();
  const dialog = page.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  await expect(dialog).toBeVisible();
  // Telefonda pastki varaqa: pastki cheti ekran pastida.
  const sheet = (await dialog.boundingBox())!;
  expect(Math.round(sheet.y + sheet.height)).toBeGreaterThanOrEqual(844 - 2);
  await noHorizontalScroll(page);
  await dialog.getByRole("button", { name: "Ha, qaytarish" }).click();

  await expect(dialog).toBeHidden();
  await expect(toast(page, "Buyurtma «Kutilmoqda» holatiga qaytarildi")).toBeVisible();
  expect(state.rollbacks).toHaveLength(1);
  expect(state.rollbacks[0].key).toMatch(/\S{8,}/);
  await expect(cardOf(page, "Malika Yusupova").getByRole("button", { name: /qaytarish/ })).toHaveCount(0);
  expect(leaked).toEqual([]);
});

test("⭐ ruxsat yo'q va «Bekor — jo'natilgan» kartalarda amal yo'q; tafsilotda sabab (390px)", async ({ page }) => {
  await mockRollbackApi(page, rows());
  await openList(page);

  await expect(cardOf(page, "Bekzod Aliyev").getByRole("button", { name: /qaytarish/ })).toHaveCount(0);
  await expect(cardOf(page, "Shahnoza Ergasheva").getByRole("button", { name: /qaytarish/ })).toHaveCount(0);
  await noHorizontalScroll(page);

  await page.goto("/orders/edit/10301");
  const note = page.getByTestId("rollback-blocked-reason");
  await expect(note).toBeVisible({ timeout: 60_000 });
  await expect(note).toContainText(SUPERADMIN_ONLY_MESSAGE);
  await expect(page.getByRole("button", { name: "Qaytarish", exact: true })).toHaveCount(0);
  await noHorizontalScroll(page);
});

test("`rollback: null` — zaxira tugma; 503 → oynada «pul ko'chmadi» va «Qayta urinish» (ayni kalit)", async ({ page }) => {
  const { state } = await mockRollbackApi(page, rows(), {
    onRolledBack: markRolledBack,
    rollbackReplies: {
      "10298": [
        {
          status: 503,
          body: { statusCode: 503, message: "Kassa ma'lumotini o'qib bo'lmadi — birozdan so'ng qayta urinib ko'ring" },
        },
      ],
    },
  });
  await openList(page);

  await cardOf(page, "Nodira Saidova").getByRole("button", { name: "№10298 ni kutilmoqda holatiga qaytarish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  await dialog.getByRole("button", { name: "Ha, qaytarish" }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("Kassa ma'lumotini o'qib bo'lmadi");
  await expect(alert).toContainText("Pul ko'chmadi. Birozdan so'ng qayta urinib ko'ring.");
  await expect(alert).toBeInViewport();

  const retry = dialog.getByRole("button", { name: "Qayta urinish" });
  expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await retry.click();
  await expect(dialog).toBeHidden();
  expect(state.rollbacks).toHaveLength(2);
  expect(state.rollbacks[1].key).toBe(state.rollbacks[0].key);
});
