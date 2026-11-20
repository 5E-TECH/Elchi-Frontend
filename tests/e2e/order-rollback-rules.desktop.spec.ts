import { expect, test } from "@playwright/test";
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
 * BE #738 (D1–D4) — menejer, 1440px: «Qaytarish» faqat server `rollback.allowed` dan; rad etilgan qatorda «—» va
 * sabab (tafsilotda «Qaytarish yopiq.»); «Bekor — jo'natilgan» — amal yo'q; `rollback: null` — zaxira qoida, server
 * qaror qiladi (STATE_CHANGED → «Qayta urinish» → buyurtma qayta o'qiladi → ayni `Idempotency-Key`).
 */

test.use({ viewport: { width: 1440, height: 900 } });
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
  rollbackOrder("10299", "Otabek Nazarov", { status: "cancelled", transport_status: "cancelled (sent)", rollback: null }),
  rollbackOrder("10298", "Nodira Saidova", { rollback: null }),
];

const openList = async (page: import("@playwright/test").Page) => {
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "№EL-10302" }).first()).toBeVisible();
};
const rowOf = (page: import("@playwright/test").Page, id: string) =>
  page.locator("tbody tr").filter({ has: page.getByRole("link", { name: `№EL-${id}`, exact: true }) });

test("⭐ ruxsat bor qator: «Qaytarish» → tasdiq → POST (Idempotency-Key), ro'yxat yangilanadi", async ({ page }) => {
  const { state, leaked } = await mockRollbackApi(page, rows(), { onRolledBack: markRolledBack });
  await openList(page);

  const allowedRow = rowOf(page, "10302");
  await allowedRow.getByRole("button", { name: "№10302 ni kutilmoqda holatiga qaytarish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ha, qaytarish" }).click();

  await expect(dialog).toBeHidden();
  await expect(toast(page, "Buyurtma «Kutilmoqda» holatiga qaytarildi")).toBeVisible();
  expect(state.rollbacks).toHaveLength(1);
  expect(state.rollbacks[0]).toMatchObject({ id: "10302", body: { target_status: "waiting" } });
  expect(state.rollbacks[0].key).toMatch(/\S{8,}/);
  // Ro'yxat qayta o'qildi: qator «Kutilmoqda», qaytarish tugmasi yo'q.
  await expect(allowedRow.getByRole("button", { name: "№10302 ni kutilmoqda holatiga qaytarish" })).toHaveCount(0);
  expect(leaked).toEqual([]);
});

test("⭐ ruxsat yo'q qator: tugma yo'q, «—» da sabab; tafsilotda «Qaytarish yopiq.» va server matni", async ({ page }) => {
  const { leaked } = await mockRollbackApi(page, rows());
  await openList(page);

  const blocked = rowOf(page, "10301");
  await expect(blocked.getByRole("button", { name: /qaytarish/ })).toHaveCount(0);
  const dash = blocked.getByLabel(`№10301 ni qaytarib bo'lmaydi: ${SUPERADMIN_ONLY_MESSAGE}`);
  await expect(dash).toHaveText("—");
  await expect(dash).toHaveAttribute("title", SUPERADMIN_ONLY_MESSAGE);

  await page.goto("/orders/edit/10301");
  const note = page.getByTestId("rollback-blocked-reason");
  await expect(note).toBeVisible({ timeout: 60_000 });
  await expect(note).toContainText("Qaytarish yopiq.");
  await expect(note).toContainText(SUPERADMIN_ONLY_MESSAGE);
  await expect(page.getByRole("button", { name: "Qaytarish", exact: true })).toHaveCount(0);
  expect(leaked).toEqual([]);
});

test("«Bekor — jo'natilgan»: server rad etgani ham, `rollback: null` (zaxira) ham — amal yo'q", async ({ page }) => {
  await mockRollbackApi(page, rows());
  await openList(page);

  for (const id of ["10300", "10299"]) {
    const row = rowOf(page, id);
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /qaytarish/ })).toHaveCount(0);
  }
  await expect(rowOf(page, "10299").getByLabel("Amal yo'q")).toHaveText("—");
  await expect(rowOf(page, "10300").getByLabel(`№10300 ni qaytarib bo'lmaydi: ${PARCEL_NOT_IN_BRANCH_MESSAGE}`)).toBeVisible();
});

test("⭐ `rollback: null` — zaxira tugma; server STATE_CHANGED → oynada sabab → «Qayta urinish» → ayni kalit, muvaffaqiyat", async ({
  page,
}) => {
  const { state, leaked } = await mockRollbackApi(page, rows(), {
    onRolledBack: markRolledBack,
    rollbackReplies: {
      "10298": [
        {
          status: 400,
          body: { statusCode: 400, code: "STATE_CHANGED", message: "Rollback holati o'zgargan — qayta urinib ko'ring" },
        },
      ],
    },
  });
  await openList(page);

  await rowOf(page, "10298").getByRole("button", { name: "№10298 ni kutilmoqda holatiga qaytarish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  await dialog.getByRole("button", { name: "Ha, qaytarish" }).click();

  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("Rollback holati o'zgargan — qayta urinib ko'ring");
  const readsBefore = state.requests.filter((entry) => entry === "GET orders/10298").length;
  await dialog.getByRole("button", { name: "Qayta urinish" }).click();

  await expect(dialog).toBeHidden();
  // Qayta urinishdan oldin buyurtma qayta o'qildi (yangi `rollback` maydoni).
  expect(state.requests.filter((entry) => entry === "GET orders/10298").length).toBeGreaterThan(readsBefore);
  expect(state.rollbacks.map((entry) => entry.id)).toEqual(["10298", "10298"]);
  expect(state.rollbacks[1].key).toBe(state.rollbacks[0].key);
  await expect(toast(page, "Buyurtma «Kutilmoqda» holatiga qaytarildi")).toBeVisible();
  expect(leaked).toEqual([]);
});

test("aniq rad (SUPERADMIN_ONLY, zaxira tugmadan): server matni oynada, asosiy tugma o'chiq", async ({ page }) => {
  await mockRollbackApi(page, rows(), {
    rollbackReplies: {
      "10298": [{ status: 400, body: { statusCode: 400, code: "SUPERADMIN_ONLY", message: SUPERADMIN_ONLY_MESSAGE } }],
    },
  });
  await openList(page);

  await rowOf(page, "10298").getByRole("button", { name: "№10298 ni kutilmoqda holatiga qaytarish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  await dialog.getByRole("button", { name: "Ha, qaytarish" }).click();

  await expect(dialog.getByRole("alert")).toContainText(SUPERADMIN_ONLY_MESSAGE);
  await expect(dialog.getByRole("button", { name: "Ha, qaytarish" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Orqaga" }).click();
  await expect(dialog).toBeHidden();
});
