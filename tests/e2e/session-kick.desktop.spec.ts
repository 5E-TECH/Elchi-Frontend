import { expect, test } from "@playwright/test";
import { e2eAccessToken, mockRealtime } from "./support/realtime";

/**
 * Elchi Pochta #3 (2026-10-24) — sessiya boshqa qurilmadan yopilsa, qurilma JOYIDA chiqadi (keyingi HTTP so'rovni
 * kutmaydi). Soxta API + soxta socket.io serveri (`support/realtime.ts`): backend `auth:session_revoked`
 * `{ session_id, reason }` yuboradi va socketni uzadi; yopilgan sessiya tokeni bilan qayta ulanish rad etiladi.
 * 1440px.
 */
const SID = "7f3c2a10-5b6d-4e8f-9a01-23456789abcd";
const REVOKED_TEXT = "Sessiyangiz boshqa qurilmadan yopildi. Davom ettirish uchun qayta kiring.";

test.describe("Sessiya boshqa qurilmadan yopildi — jonli kanal, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ «Chiqarish»: hodisa kelishi bilan /login, «Sessiya tugadi» sababi bilan; POST auth/logout va refresh yo'q, qayta ulanish yo'q", async ({ page }) => {
    const { state, kick } = await mockRealtime(page, { token: e2eAccessToken({ sid: SID }) });
    await page.goto("/inbox");
    await expect(page.getByText("Kun yakuni eslatmasi").first()).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => state.auth.length).toBe(1);

    // Foydalanuvchi hech narsa bosmaydi (bo'sh turgan tab) — boshqa qurilmadan «Chiqarish».
    kick({ session_id: SID, reason: "revoked_by_owner" });

    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Sessiya tugadi" })).toBeVisible();
    await expect(page.getByText(REVOKED_TEXT)).toBeVisible();
    await page.waitForTimeout(2_000);
    // Qayta yuklangandan keyin ham xabar joyida (xabar yo'qolib, oddiy forma chiqmaydi).
    await expect(page.getByText(REVOKED_TEXT)).toBeVisible();
    expect(state.logoutRequests).toBe(0);
    expect(state.refreshRequests).toBe(0);
    expect(state.sockets).toHaveLength(1);
    expect(await page.evaluate(() => window.sessionStorage.getItem("accessToken"))).toBeNull();

    await page.getByRole("button", { name: "Qayta kirish" }).click();
    await expect(page.getByRole("heading", { name: "Tizimga kirish" })).toBeVisible();
  });

  test("⭐ parol almashtirildi (`password_changed`) — ekran shu sababni aytadi", async ({ page }) => {
    const { state, kick } = await mockRealtime(page, { token: e2eAccessToken({ sid: SID }) });
    await page.goto("/inbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);

    kick({ session_id: SID, reason: "password_changed" });

    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Sessiya tugadi" })).toBeVisible();
    await expect(page.getByText("Parol almashtirildi. Davom ettirish uchun yangi parol bilan qayta kiring.")).toBeVisible();
    expect(state.logoutRequests).toBe(0);
  });

  test("⭐ boshqa sessiya hodisasi (`session_id` mos emas) — e'tiborsiz: sahifa va kanal joyida", async ({ page }) => {
    const { state, kick, dispatch } = await mockRealtime(page, { token: e2eAccessToken({ sid: SID }) });
    await page.goto("/inbox");
    await expect(page.getByText("Kun yakuni eslatmasi").first()).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => state.auth.length).toBe(1);
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

    kick({ session_id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", reason: "revoked_by_owner" }, { revoke: false });
    await page.waitForTimeout(1_500);

    await expect(page).toHaveURL(/\/inbox$/);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    expect(state.closed).toBe(0);
    // Kanal ishlayveradi — keyingi bildirishnoma keladi.
    dispatch({ id: "n-2", title: "Buyurtma sotildi", body: "№10225", category: "order", link: "/orders/10225" });
    await expect(
      page.getByRole("region", { name: "Bildirishnomalar", exact: true }).getByText("Buyurtma sotildi", { exact: true }),
    ).toBeVisible();
  });

  test("⭐ uxlab qolgan tab: aloqa uzilib qaytdi, yopilgan sessiya bilan qayta ulanish rad etildi — darhol /login", async ({ page }) => {
    const { state } = await mockRealtime(page, { token: e2eAccessToken({ sid: SID }) });
    await page.goto("/inbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);

    // Tab uxlab turganda sessiya yopildi (hodisa yetib bormadi); aloqa uzildi. Faqat jonli kanal yo'li sinaladi:
    // HTTP javob beraveradi (aks holda uzilishdan keyingi sanoq so'rovi 401 → refresh 401 → login zaxira yo'li
    // birinchi ishlaydi — u ham to'g'ri, `profile-sessions` e2e uni sinaydi).
    state.socketRevoked = true;
    await state.sockets[0].close({ code: 1006, reason: "network" });

    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
    await expect(page.getByText(REVOKED_TEXT)).toBeVisible();
    expect(state.sockets).toHaveLength(2);
    expect(state.logoutRequests).toBe(0);
    await page.waitForTimeout(2_000);
    // Rad etilgandan keyin qayta urinish aylanmasi yo'q.
    expect(state.sockets).toHaveLength(2);
  });
});

test.describe("Sessiya boshqa qurilmadan yopildi — 390px", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ kuryer telefoni: hodisa kelishi bilan «Sessiya tugadi» ekrani, gorizontal skrolsiz; POST auth/logout yo'q", async ({ page }) => {
    const { state, kick } = await mockRealtime(page, {
      token: e2eAccessToken({ sid: SID, role: "courier" }),
      role: "courier",
    });
    await page.goto("/inbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);

    kick({ session_id: SID, reason: "security_reset" });

    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Sessiya tugadi" })).toBeVisible();
    await expect(page.getByText(REVOKED_TEXT)).toBeVisible();
    const relogin = page.getByRole("button", { name: "Qayta kirish" });
    await expect(relogin).toBeVisible();
    expect((await relogin.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.waitForTimeout(1_500);
    expect(state.logoutRequests).toBe(0);
    expect(state.refreshRequests).toBe(0);
    expect(state.sockets).toHaveLength(1);
  });
});
