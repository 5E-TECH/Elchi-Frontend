import { expect, test } from "@playwright/test";
import { mockRealtime } from "./support/realtime";

/**
 * rWdLuoP3 — smena hodisalari jonli kanal orqali: ochiq «Asosiy kassa» sahifasi sahifani yangilamasdan smena
 * holatini (`GET finance/shift/current`) va kassani qayta so'raydi (2 s ichida); avtomatik yopilganda kassirga
 * «Smena avtomatik yopildi — HH:MM». Soxta API + soxta socket.io (`support/realtime.ts`), 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

const shiftRequests = (requests: string[]) => requests.filter((path) => path === "finance/shift/current").length;

for (const event of ["finance.shift.closed", "finance.shift.account_checked"] as const) {
  test(`⭐ ${event}: smena holati va kassa 2 s ichida qayta so'raladi, xabar yo'q`, async ({ page }) => {
    const { state, emit } = await mockRealtime(page);
    await page.goto("/payments/main-cashbox");
    await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);
    await expect.poll(() => shiftRequests(state.requests), { timeout: 60_000 }).toBeGreaterThan(0);
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    const before = shiftRequests(state.requests);
    const cashboxBefore = state.requests.filter((path) => path.startsWith("finance/cashbox")).length;

    emit(event, { shift_id: "s-1" });

    await expect.poll(() => shiftRequests(state.requests), { timeout: 2_000 }).toBeGreaterThan(before);
    await expect
      .poll(() => state.requests.filter((path) => path.startsWith("finance/cashbox")).length, { timeout: 2_000 })
      .toBeGreaterThan(cashboxBefore);
    await expect(page.getByText(/Smena avtomatik yopildi/)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  });
}

test("⭐ finance.shift.auto_closed: «Smena avtomatik yopildi — 18:00» (Toshkent vaqti), smena qayta so'raladi", async ({ page }) => {
  const { state, emit } = await mockRealtime(page);
  await page.goto("/payments/main-cashbox");
  await expect.poll(() => state.auth.length, { timeout: 90_000 }).toBe(1);
  await expect.poll(() => shiftRequests(state.requests), { timeout: 60_000 }).toBeGreaterThan(0);
  const before = shiftRequests(state.requests);

  emit("finance.shift.auto_closed", { shift_id: "s-1", closed_at: "2026-10-23T13:00:00.000Z" });

  const toasts = page.getByRole("region", { name: "Bildirishnomalar", exact: true });
  await expect(toasts.getByText("Smena avtomatik yopildi — 18:00")).toBeVisible();
  await expect.poll(() => shiftRequests(state.requests), { timeout: 2_000 }).toBeGreaterThan(before);
});
