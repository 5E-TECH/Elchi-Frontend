import { expect, test } from "@playwright/test";
import { mockBatchesApi } from "./support/batches";

/**
 * PAKETNI BEKOR QILISH (Trello oP02jE2P) — paket sahifasida (`/batches/:id`), 1440px. Menejer — manba filial
 * (Urgut, id 7): «Paketni bekor qilish» → tasdiq oynasi (raqam, yo'nalish, holat, son, sabab ≥ 10) →
 * `POST transfer-batches/172/cancel { reason }`. Yo'ldagi paket (409 `batch_in_transit`) — «Paket yo'lda …».
 */
test.describe("Paketni bekor qilish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  const REASON = "Noto'g'ri filialga yig'ilgan";

  test("⭐ sabab bilan tasdiqlanadi → { reason } yuboriladi, paket «Bekor qilingan», tugma yo'qoladi", async ({ page }) => {
    const { leaked, cancels } = await mockBatchesApi(page, {
      cancel: () => ({ status: 201, body: { statusCode: 201, message: "Batch cancelled", data: { id: "172" } } }),
    });
    await page.goto("/batches/172");
    await expect(page.getByRole("heading", { level: 1, name: "Paket B-172" })).toBeVisible({ timeout: 60_000 });

    const header = page.locator('[data-shell-slot="content"] header').first();
    await header.getByRole("button", { name: "Paketni bekor qilish" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Paketni bekor qilasizmi?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Paket B-172 · Yaratilgan:");
    await expect(dialog).toContainText("Urgut filiali");
    await expect(dialog).toContainText("Toshkent HQ");
    await expect(dialog).toContainText("Yangi");
    await expect(dialog).toContainText("3 ta");

    // Qisqa sabab — so'rov ketmaydi.
    const reason = dialog.getByRole("textbox", { name: /Sabab/ });
    await reason.fill("qisqa");
    await dialog.getByRole("button", { name: "Paketni bekor qilish" }).click();
    await expect(dialog.getByText("Sabab kamida 10 ta belgidan iborat bo'lishi kerak (hozir 5 ta)")).toBeVisible();
    expect(cancels).toEqual([]);

    await reason.fill(REASON);
    await dialog.getByRole("button", { name: "Paketni bekor qilish" }).click();
    await expect(page.getByText("Paket bekor qilindi", { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(cancels).toEqual([{ reason: REASON }]);

    // Paket qayta o'qildi: holat «Bekor qilingan», tugma yo'q.
    await expect(header.getByText("Bekor qilingan")).toBeVisible();
    await expect(header.getByRole("button", { name: "Paketni bekor qilish" })).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ 409 batch_in_transit — oynada «Paket yo'lda …», tugma o'chadi, hech narsa bekor bo'lmaydi", async ({ page }) => {
    const { leaked, cancels } = await mockBatchesApi(page, {
      cancel: () => ({
        status: 409,
        body: {
          statusCode: 409,
          message: "Paket yo'lda — jo'natilgan paketni bekor qilib bo'lmaydi",
          data: { reason: "batch_in_transit", details: { batch_id: "172", status: "SENT" } },
        },
      }),
    });
    await page.goto("/batches/172");
    await expect(page.getByRole("heading", { level: 1, name: "Paket B-172" })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Paketni bekor qilish" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Paketni bekor qilasizmi?" });
    await dialog.getByRole("textbox", { name: /Sabab/ }).fill(REASON);
    await dialog.getByRole("button", { name: "Paketni bekor qilish" }).click();

    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("Paket yo'lda — jo'natilgan paketni bekor qilib bo'lmaydi");
    await expect(dialog.getByRole("button", { name: "Paketni bekor qilish" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Orqaga" })).toBeFocused();
    expect(cancels).toHaveLength(1);
    await expect(page.getByText("Paket bekor qilindi", { exact: true })).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("boshqa filial menejeri — tugma yo'q", async ({ page }) => {
    const { leaked } = await mockBatchesApi(page, { branchId: "1" });
    await page.goto("/batches/172");
    await expect(page.getByRole("heading", { level: 1, name: "Paket B-172" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "HQ'ga yuborish — 0 ta" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Paketni bekor qilish" })).toHaveCount(0);
    expect(leaked).toEqual([]);
  });
});
