import { expect, test } from "@playwright/test";
import { CRITICAL, KPI_OK, PARTIAL, healthCard, mockSystemOpsApi, openSystemOps, readiness } from "./support/systemOps";

/**
 * OPS → TIZIM (/ops?tab=system, OS-1 — maketlar `superadmin-ops-system[-partial|-critical|-error|-down]`):
 * «Tizim holati» `GET /health/readiness` dan (503 ham javob), xom backend matni chiqmaydi, «Yangilash» va
 * «Qayta urinish» qayta so'raydi, KPI xatosi — danger ogohlantirish.
 */
test.describe("Ops → Tizim — Tizim holati — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ 503 qisman: warning, jadvalda sabab (xom emas); «Yangilash» — hammasi ishlayapti, ro'yxat yopiladi", async ({ page }) => {
    const { leaked, calls } = await mockSystemOpsApi(page, { health: [PARTIAL, readiness()] });
    await openSystemOps(page);
    const card = healthCard(page);

    await expect(card.getByText("2 ta xizmat javob bermayapti")).toBeVisible();
    await expect(card.getByText("Qisman ishlayapti")).toBeVisible();
    await expect(
      card.getByText("14 ta xizmatdan 12 tasi ishlayapti. Bildirishnomalar va qidiruv bilan bog'liq amallar xato berishi mumkin."),
    ).toBeVisible();
    const rows = card.getByRole("table", { name: "Xizmatlar holati" }).locator("tbody tr");
    await expect(rows).toHaveCount(14);
    await expect(rows.nth(0)).toContainText("Bildirishnomalar va Telegram bot");
    await expect(rows.nth(0)).toContainText("Xizmat o'zini nosoz deb bildirdi");
    await expect(rows.nth(1)).toContainText("Javob kutilgan vaqtda kelmadi");
    await expect(rows.nth(1)).toContainText("1 502 ms");
    await expect(page.getByText(/reported degraded|Timeout has occurred/)).toHaveCount(0);

    await card.getByRole("button", { name: "Yangilash" }).click();
    await expect(card.getByText("Hamma xizmatlar ishlayapti")).toBeVisible();
    await expect(card.getByRole("button", { name: /Xizmatlar ro'yxati/ })).toHaveAttribute("aria-expanded", "false");
    await expect(card.getByRole("table")).toHaveCount(0);
    expect(calls.health).toBe(2);
    expect(leaked).toEqual([]);
  });

  test("⭐ S1 asosiy xizmat ishlamayapti: danger sarlavha, «Noma'lum: 1», xom xato matni yo'q", async ({ page }) => {
    const { leaked } = await mockSystemOpsApi(page, { health: [CRITICAL] });
    await openSystemOps(page);
    const card = healthCard(page);
    await expect(card.getByText("Asosiy xizmat ishlamayapti: Buyurtmalar")).toBeVisible();
    await expect(card.getByText("Ishlamayapti", { exact: true }).first()).toBeVisible();
    await expect(card.getByText("Noma'lum: 1")).toBeVisible();
    await expect(page.getByText(/ECONNREFUSED|client not registered/)).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ readiness 504: «Tizim holatini olib bo'lmadi», «Xato kodi: 504»; «Qayta urinish» — tiklanadi", async ({ page }) => {
    const { calls } = await mockSystemOpsApi(page, {
      // 5xx bir marta qayta urinadi (`queryRetry.ts`) — ikkala urinish ham 504.
      health: [
        { status: 504, body: { message: "upstream timed out (raw)" } },
        { status: 504, body: { message: "upstream timed out (raw)" } },
        readiness(),
      ],
    });
    await openSystemOps(page);
    const card = healthCard(page);
    await expect(card.getByText("Tizim holatini olib bo'lmadi")).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText("Xato kodi: 504")).toBeVisible();
    await expect(card.getByText("Noma'lum")).toBeVisible();
    await expect(page.getByText("upstream timed out (raw)")).toHaveCount(0);
    await card.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(card.getByText("Hamma xizmatlar ishlayapti")).toBeVisible();
    expect(calls.health).toBe(3);
  });

  test("⭐ KPI xatosi: «Analitika ko'rsatkichlarini olib bo'lmadi» (xom matnsiz), «Qayta urinish» — KPI chiziladi", async ({ page }) => {
    await mockSystemOpsApi(page, {
      kpi: [
        { status: 500, body: { statusCode: 500, message: "analytics RPC failed (raw)" } },
        { status: 500, body: { statusCode: 500, message: "analytics RPC failed (raw)" } },
        KPI_OK,
      ],
    });
    await openSystemOps(page);
    const alert = page.getByRole("alert").filter({ hasText: "Analitika ko'rsatkichlarini olib bo'lmadi" });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText("Analitika xizmati javob bermadi.");
    await expect(page.getByText("analytics RPC failed (raw)")).toHaveCount(0);
    await alert.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(page.getByText("236 400 so'm")).toBeVisible();
  });
});
