import { expect, test } from "@playwright/test";
import { mockRealtime } from "./support/realtime";

/**
 * uRkw6lk0 — bildirishnomalar jonli kanal orqali (socket.io `/realtime`), sahifani yangilamasdan. 1440px.
 * Soxta API + soxta socket.io serveri (`support/realtime.ts`).
 */
test.describe("Jonli bildirishnomalar — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC1/TC2/TC3/TC10: WebSocket ulanadi; dispatch — badge oshadi, xabar chiqadi, inbox ro'yxati boshida, «Ochish» havolaga", async ({ page }) => {
    const { state, dispatch } = await mockRealtime(page);
    await page.goto("/inbox");

    await expect(page.getByRole("button", { name: "Bildirishnomalar, 2 ta yangi" })).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => state.auth.length).toBe(1);
    expect(state.socketUrls[0]).toMatch(/\/socket\.io\/\?EIO=4&transport=websocket/);
    expect(state.auth[0]).toEqual({ token: "e2e.local.token" });
    await expect(page.getByText("Kun yakuni eslatmasi").first()).toBeVisible();
    // Sahifa qayta yuklanmasligini tekshirish uchun belgi.
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    const unreadBefore = state.unreadRequests;

    dispatch({ id: "n-2", title: "Buyurtma sotildi", body: "№10225 · Baraka Shop", category: "order", link: "/orders/10225" });

    await expect(page.getByRole("button", { name: "Bildirishnomalar, 3 ta yangi" })).toBeVisible();
    expect(state.unreadRequests).toBeGreaterThan(unreadBefore);
    const toasts = page.getByRole("region", { name: "Bildirishnomalar", exact: true });
    await expect(toasts.getByText("Buyurtma sotildi", { exact: true })).toBeVisible();
    await expect(toasts.getByText("Buyurtma · №10225 · Baraka Shop")).toBeVisible();
    // Inbox ochiq — yangi qator ro'yxat boshida.
    const content = page.locator("[data-shell-slot=content]");
    const fresh = content.getByText("Buyurtma sotildi").first();
    await expect(fresh).toBeVisible();
    const older = content.getByText("Kun yakuni eslatmasi").first();
    expect((await fresh.boundingBox())!.y).toBeLessThan((await older.boundingBox())!.y);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

    await toasts.getByRole("button", { name: "Ochish" }).click();
    await expect(page).toHaveURL(/\/orders\/10225$/);
  });

  test("⭐ TC7: bitta hodisa ikki marta kelsa — xabar bitta", async ({ page }) => {
    const { state } = await mockRealtime(page);
    await page.goto("/inbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);

    const frame = `42/realtime,${JSON.stringify(["notification:new", { id: "n-5", title: "Kassa topshirildi", body: null, category: "finance", link: "/cash-box" }])}`;
    state.sockets[0].send(frame);
    state.sockets[0].send(frame);

    const toasts = page.getByRole("region", { name: "Bildirishnomalar", exact: true });
    await expect(toasts.getByText("Kassa topshirildi", { exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(toasts.getByText("Kassa topshirildi", { exact: true })).toHaveCount(1);
  });

  test("⭐ TC4: aloqa uzilsa — sanoq darhol so'raladi (polling zaxirasi) va socket o'zi qayta ulanadi", async ({ page }) => {
    const { state } = await mockRealtime(page);
    await page.goto("/inbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);
    const unreadBefore = state.unreadRequests;

    await state.sockets[0].close({ code: 1006, reason: "network" });

    await expect.poll(() => state.unreadRequests).toBeGreaterThan(unreadBefore);
    await expect.poll(() => state.auth.length, { timeout: 30_000 }).toBe(2);
  });

  test("⭐ TC5: chiqishda socket uziladi va qayta ulanmaydi", async ({ page }) => {
    const { state } = await mockRealtime(page);
    await page.goto("/inbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);

    await page.getByRole("button", { name: /Profil menyusi/ }).first().click();
    await page.getByRole("menuitem", { name: "Chiqish" }).click();
    const confirm = page.getByRole("alertdialog");
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole("button", { name: "Chiqish" }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect.poll(() => state.closed).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(3000);
    expect(state.sockets).toHaveLength(1);
  });
});
