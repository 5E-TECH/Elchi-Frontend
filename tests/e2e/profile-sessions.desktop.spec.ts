import { expect, test } from "@playwright/test";
import { openProfileWithSessions } from "./support/profileSessions";
import { expectToast } from "./support/toast";

/**
 * EP-3 (Elchi Pochta #3) — /profile «Sessiyalar» (desktop): FAQAT o'z hisobining faol sessiyalari — soni, qurilma,
 * IP, «Kirgan vaqti», «Oxirgi faollik»; «Shu qurilma» tepada; nomsiz qurilma — «Noma'lum qurilma».
 * Boshqa qurilmalarni chiqarish: qatordagi «Chiqarish» va «Boshqa barcha qurilmalardan chiqish» (tasdiq bilan);
 * yopilgan qurilma keyingi so'rovida 401 → refresh 401 → «Sessiya tugadi» (kirish sahifasi), aylanishsiz.
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ sessiyalar soni, qurilmalar va vaqtlar; «Shu qurilma» tepada", async ({ page }) => {
  const { leaked, state } = await openProfileWithSessions(page, "superadmin");

  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByText("3 ta faol")).toBeVisible();

  const rows = card.getByRole("list", { name: "Faol sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByRole("heading", { level: 3 })).toHaveText("Telefon · Android · Chrome");
  await expect(rows.nth(0).getByText("Shu qurilma")).toBeVisible();
  await expect(rows.nth(0).getByText("IP: 213.230.64.10")).toBeVisible();
  await expect(rows.nth(0).getByText("Oxirgi faollik")).toBeVisible();
  await expect(rows.nth(0).getByText("42 daqiqa oldin")).toBeVisible();
  await expect(rows.nth(1).getByRole("heading", { level: 3 })).toHaveText("Kompyuter · Windows · Edge");
  await expect(rows.nth(1).getByText("7 daqiqa oldin")).toBeVisible();
  await expect(rows.nth(1).getByText("Shu qurilma")).toHaveCount(0);
  await expect(rows.nth(2).getByRole("heading", { level: 3 })).toHaveText("Noma'lum qurilma");
  await expect(rows.nth(2).getByText("IP noma'lum")).toBeVisible();
  await expect(rows.nth(2).getByText("3 kun oldin")).toBeVisible();

  // Desktopda qurilma va vaqtlar bir qatorda (vaqtlar o'ngda).
  const deviceBox = await rows.nth(0).getByRole("heading", { level: 3 }).boundingBox();
  const timeBox = await rows.nth(0).getByText("Kirgan vaqti").boundingBox();
  expect(Math.abs((deviceBox?.y ?? 0) - (timeBox?.y ?? 999))).toBeLessThan(24);
  expect(timeBox?.x ?? 0).toBeGreaterThan((deviceBox?.x ?? 0) + 300);

  expect(state.sessionRequests).toBeGreaterThanOrEqual(1);
  expect(leaked).toEqual([]);
});

test("⭐ qatordagi «Chiqarish»: tasdiqda qurilma → DELETE → xabar, qator yo'qoladi; joriy qatorda amal yo'q", async ({ page }) => {
  const { leaked, revoke } = await openProfileWithSessions(page, "superadmin", { revoke: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Faol sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("button", { name: /^Chiqarish:/ })).toHaveCount(2);

  // Desktopda amal qatorning o'ng chetida, vaqtlar bilan bir qatorda.
  const action = rows.nth(1).getByRole("button", { name: "Chiqarish: Kompyuter · Windows · Edge" });
  const actionBox = (await action.boundingBox())!;
  const rowBox = (await rows.nth(1).boundingBox())!;
  expect(actionBox.x + actionBox.width).toBeGreaterThan(rowBox.x + rowBox.width - 40);

  await action.click();
  const confirm = page.getByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
  await expect(confirm.getByText("Kompyuter · Windows · Edge")).toBeVisible();
  await expect(confirm.getByText(/IP: 84\.54\.70\.12/)).toBeVisible();
  await confirm.getByRole("button", { name: "Chiqarish" }).click();

  await expectToast(page, "Qurilma chiqarildi", { tone: "success" });
  await expect(confirm).toBeHidden();
  await expect(rows).toHaveCount(2);
  await expect(card.getByText("2 ta faol")).toBeVisible();
  await expect(card.getByRole("heading", { name: "Kompyuter · Windows · Edge" })).toHaveCount(0);
  expect(revoke!.deletes).toEqual(["s-2"]);
  expect(leaked).toEqual([]);
});

test("«Boshqa barcha qurilmalardan chiqish»: tasdiqda soni → POST → faqat shu qurilma; 404 — «allaqachon yopilgan»", async ({ page }) => {
  const { leaked, revoke } = await openProfileWithSessions(page, "admin", { revoke: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Faol sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);

  // Boshqa oynadan yopilgan sessiya: 404 — xato emas, ro'yxat yangilanadi.
  revoke!.sessions = revoke!.sessions.filter((row) => row.id !== "s-3");
  await rows.nth(2).getByRole("button", { name: /^Chiqarish:/ }).click();
  await page.getByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" }).getByRole("button", { name: "Chiqarish" }).click();
  await expectToast(page, "Bu sessiya allaqachon yopilgan", { tone: "info" });
  await expect(rows).toHaveCount(2);

  await card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
  await expect(confirm.getByText(/Boshqa 1 ta qurilma hisobingizdan chiqariladi/)).toBeVisible();
  await expect(confirm.getByText("Shu qurilma tizimda qoladi.")).toBeVisible();
  await confirm.getByRole("button", { name: "Hammasini chiqarish" }).click();

  await expectToast(page, "Boshqa qurilmalardan chiqildi", { tone: "success" });
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0).getByText("Shu qurilma")).toBeVisible();
  await expect(card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toHaveCount(0);
  expect(revoke!.revokeOthers).toBe(1);
  expect(revoke!.deletes).toEqual(["s-3"]);
  expect(leaked).toEqual([]);
});

test("yopilgan qurilma: keyingi so'rov 401 → refresh 401 → kirish sahifasida «Sessiya tugadi», qayta urinish aylanmasi yo'q", async ({ page }) => {
  const { revoke } = await openProfileWithSessions(page, "courier", { revoke: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });

  // Shu qurilma boshqa qurilmadan chiqarildi; foydalanuvchi oynaga qaytadi — sessiyalar qayta so'raladi.
  revoke!.revokedHere = true;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Sessiya tugadi" })).toBeVisible();
  // Parallel 401 lar umumiy refresh'ni kutadi; kirish sahifasida so'rovlar to'xtaydi — son o'smaydi (aylanma yo'q).
  const refreshes = revoke!.refreshes;
  const logouts = revoke!.logouts;
  await page.waitForTimeout(2_000);
  expect(revoke!.refreshes).toBe(refreshes);
  expect(revoke!.logouts).toBe(logouts);
  expect(refreshes).toBeGreaterThanOrEqual(1);
  expect(refreshes).toBeLessThanOrEqual(3);
});
