import { expect, test } from "@playwright/test";
import { toast } from "./support/toast";
import { CRITICAL, PARTIAL, botHealth, healthCard, mockSystemOpsApi, openSystemOps, readiness } from "./support/systemOps";

/**
 * OPS → TIZIM (/ops?tab=system, OS-1 — maketlar `superadmin-ops-system[-partial|-critical|-error|-down]`):
 * «Tizim holati» `GET /health/readiness` dan (503 ham javob), xom backend matni chiqmaydi, «Yangilash» va
 * «Qayta urinish» qayta so'raydi.
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

  test("⭐ BOT-DIAG: token rad etildi — aniq sabab va keyingi qadam, «Qayta ishga tushirish kerak», tugma yo'q", async ({ page }) => {
    const { leaked } = await mockSystemOpsApi(page, {
      health: [PARTIAL],
      bot: [
        botHealth({
          error_kind: "token_rejected",
          error_status: 401,
          error_text: "Telegram getMe failed (401): Unauthorized",
          restart_required: true,
        }),
      ],
    });
    await openSystemOps(page);
    const card = healthCard(page);
    const panel = card.getByRole("region", { name: "Telegram bot holati" });
    await expect(panel.getByText("Telegram bot tokeni rad etildi (401)")).toBeVisible();
    await expect(panel.getByText(/BotFather'dan yangi token oling/)).toBeVisible();
    await expect(panel.getByText(/^Oxirgi tekshiruv: Bugun, \d{2}:\d{2}$/)).toBeVisible();
    await expect(panel.getByText("Qayta ishga tushirish kerak")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Qayta tekshirish" })).toHaveCount(0);
    const row = card.getByRole("table", { name: "Xizmatlar holati" }).locator("tbody tr").nth(0);
    await expect(row).toContainText("Telegram bot tokeni rad etildi (401)");
    await expect(row).not.toContainText("Bot tokeni yoki bog'liq tizim");
    expect(leaked).toEqual([]);
  });

  test("⭐ BOT-DIAG: «Qayta tekshirish» — bot tiklandi: xabar, readiness qayta o'qiladi, blok yo'qoladi", async ({ page }) => {
    const { leaked, calls } = await mockSystemOpsApi(page, {
      health: [PARTIAL, readiness({ SEARCH: { status: "down", latency_ms: 1502, error: "Timeout has occurred" } })],
      bot: [botHealth()],
      recheck: [botHealth({ healthy: true, error_kind: null, error_text: null, username: "elchi_bot" }, { rechecked: true })],
    });
    await openSystemOps(page);
    const card = healthCard(page);
    const panel = card.getByRole("region", { name: "Telegram bot holati" });
    await expect(panel.getByText("Server Telegram'ga ulana olmayapti")).toBeVisible();
    await expect(panel.getByText("Telegram getMe failed (0): fetch failed (ENOTFOUND)")).toBeVisible();
    await panel.getByRole("button", { name: "Qayta tekshirish" }).click();
    await expect(toast(page, "Bot ishlayapti", { tone: "success" })).toContainText("Telegram @elchi_bot botini tasdiqladi");
    await expect(card.getByRole("region", { name: "Telegram bot holati" })).toHaveCount(0);
    await expect(card.getByText("1 ta xizmat javob bermayapti")).toBeVisible();
    expect(calls.recheck).toBe(1);
    expect(calls.health).toBe(2);
    expect(leaked).toEqual([]);
  });

  test("BOT-DIAG: endpoint 404 (backend hali deploy qilinmagan) — umumiy matn, sahifa buzilmaydi", async ({ page }) => {
    const { leaked } = await mockSystemOpsApi(page, {
      health: [PARTIAL],
      bot: [{ status: 404, body: { statusCode: 404, message: "Cannot GET /health/notification-bot" } }],
    });
    await openSystemOps(page);
    const card = healthCard(page);
    const row = card.getByRole("table", { name: "Xizmatlar holati" }).locator("tbody tr").nth(0);
    await expect(row).toContainText("Bot tokeni yoki bog'liq tizim tekshiruvdan o'tmagan bo'lishi mumkin");
    await expect(card.getByRole("region", { name: "Telegram bot holati" })).toHaveCount(0);
    await expect(page.getByText(/Cannot GET/)).toHaveCount(0);
    expect(leaked).toEqual([]);
  });
});
