import { expect, test } from "@playwright/test";
import { formatLockTime, lockAvailableAt, openProfileWithSessions, SESSIONS } from "./support/profileSessions";
import { expectToast } from "./support/toast";

/**
 * EP-3 (Elchi Pochta #3) — /profile «Sessiyalar» (desktop): FAQAT o'z hisobining sessiyalari — faollar soni,
 * qurilma (aniq nom), tarmoq IP, «Kirgan vaqti» (oxirgi + «Birinchi marta»), «Oxirgi faollik»; «Shu qurilma»
 * tepada, qayta kirishi kerak bo'lgani (`expired`) oxirida, xiralashgan; nomsiz qurilma — «Noma'lum qurilma».
 * Boshqa qurilmalarni chiqarish: qatordagi «Chiqarish» va «Boshqa barcha qurilmalardan chiqish» (tasdiq bilan);
 * yopilgan qurilma keyingi so'rovida 401 → refresh 401 → «Sessiya tugadi» (kirish sahifasi), aylanishsiz.
 * Yangi qurilma (48 soat, Telegram kabi): `can_revoke_others: false` — ogohlantirish (sabab, vaqt, «parolni
 * almashtiring» + parol oynasi havolasi), ikkala amal o'chirilgan (sababi `aria-describedby` va `title` da);
 * baribir 403 `SESSION_TOO_NEW` — tasdiq yopiladi, server matni ogohlantirish xabarida, ro'yxat qayta so'raladi.
 */
test.describe.configure({ timeout: 120_000 });
// Cheklov vaqti to'liq sana bilan chiziladi — brauzer vaqti foydalanuvchilarnikidek (CI esa UTC da).
test.use({ timezoneId: "Asia/Tashkent" });

const LOCK_REASON = "Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi.";

test("⭐ sessiyalar soni, qurilmalar va vaqtlar; «Shu qurilma» tepada, `expired` oxirida", async ({ page }) => {
  const { leaked, state } = await openProfileWithSessions(page, "superadmin");

  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  // Faqat faollar: `expired` sanalmaydi.
  await expect(card.getByText("3 ta faol")).toBeVisible();

  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0).getByRole("heading", { level: 3 })).toHaveText("Samsung SM-A515F · Android 13 · Chrome 155");
  await expect(rows.nth(0).getByText("Shu qurilma")).toBeVisible();
  await expect(rows.nth(0).getByText("Tarmoq IP: 213.230.64.10")).toBeVisible();
  await expect(rows.nth(0).getByText(/^Birinchi marta: \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/)).toBeVisible();
  await expect(rows.nth(0).getByText("Oxirgi faollik")).toBeVisible();
  await expect(rows.nth(0).getByText("42 daqiqa oldin")).toBeVisible();
  await expect(rows.nth(1).getByRole("heading", { level: 3 })).toHaveText("Kompyuter · Windows · Edge");
  await expect(rows.nth(1).getByText("7 daqiqa oldin")).toBeVisible();
  await expect(rows.nth(1).getByText("Shu qurilma")).toHaveCount(0);
  await expect(rows.nth(1).getByText(/Birinchi marta/)).toHaveCount(0);
  await expect(rows.nth(2).getByRole("heading", { level: 3 })).toHaveText("Noma'lum qurilma");
  await expect(rows.nth(2).getByText("Tarmoq IP noma'lum")).toBeVisible();
  await expect(rows.nth(2).getByText("3 kun oldin")).toBeVisible();
  await expect(rows.nth(2).getByText(/Birinchi marta/)).toHaveCount(0);
  // Qayta kirishi kerak: oxirida, xiralashgan (asosiy matn `text-muted`), belgi bilan, «Chiqarish» bor.
  const expired = rows.nth(3);
  await expect(expired).toHaveAttribute("data-session-status", "expired");
  await expect(expired.getByRole("heading", { level: 3 })).toHaveText("iPhone · iOS 17 · Safari");
  await expect(expired.getByText("Qayta kirish kerak")).toBeVisible();
  await expect(expired.getByRole("button", { name: "Chiqarish: iPhone · iOS 17 · Safari" })).toBeVisible();
  const [activeColor, expiredColor] = await Promise.all(
    [rows.nth(1), expired].map((row) =>
      row.getByRole("heading", { level: 3 }).evaluate((node) => getComputedStyle(node).color),
    ),
  );
  expect(expiredColor).not.toBe(activeColor);

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
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0).getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("button", { name: /^Chiqarish:/ })).toHaveCount(3);

  // Desktopda amal qatorning o'ng chetida, vaqtlar bilan bir qatorda.
  const action = rows.nth(1).getByRole("button", { name: "Chiqarish: Kompyuter · Windows · Edge" });
  const actionBox = (await action.boundingBox())!;
  const rowBox = (await rows.nth(1).boundingBox())!;
  expect(actionBox.x + actionBox.width).toBeGreaterThan(rowBox.x + rowBox.width - 40);

  await action.click();
  const confirm = page.getByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
  await expect(confirm.getByText("Kompyuter · Windows · Edge")).toBeVisible();
  await expect(confirm.getByText(/Tarmoq IP: 84\.54\.70\.12/)).toBeVisible();
  await confirm.getByRole("button", { name: "Chiqarish" }).click();

  await expectToast(page, "Qurilma chiqarildi", { tone: "success" });
  await expect(confirm).toBeHidden();
  await expect(rows).toHaveCount(3);
  await expect(card.getByText("2 ta faol")).toBeVisible();
  await expect(card.getByRole("heading", { name: "Kompyuter · Windows · Edge" })).toHaveCount(0);

  // Qayta kirishi kerak bo'lgan qurilma: o'z izohi bilan tasdiq; faollar soni o'zgarmaydi.
  await card.getByRole("button", { name: "Chiqarish: iPhone · iOS 17 · Safari" }).click();
  const expiredConfirm = page.getByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
  await expect(expiredConfirm.getByText(/U baribir qayta kirishi kerak edi/)).toBeVisible();
  await expiredConfirm.getByRole("button", { name: "Chiqarish" }).click();
  await expectToast(page, "Qurilma chiqarildi", { tone: "success" });
  await expect(rows).toHaveCount(2);
  await expect(card.getByText("2 ta faol")).toBeVisible();
  await expect(card.getByText("Qayta kirish kerak")).toHaveCount(0);
  expect(revoke!.deletes).toEqual(["s-2", "s-4"]);
  expect(leaked).toEqual([]);
});

test("«Boshqa barcha qurilmalardan chiqish»: tasdiqda soni → POST → faqat shu qurilma; 404 — «allaqachon yopilgan»", async ({ page }) => {
  const { leaked, revoke } = await openProfileWithSessions(page, "admin", { revoke: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);

  // Boshqa oynadan yopilgan sessiya: 404 — xato emas, ro'yxat yangilanadi.
  revoke!.sessions = revoke!.sessions.filter((row) => row.id !== "s-3");
  await rows.nth(2).getByRole("button", { name: /^Chiqarish:/ }).click();
  await page.getByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" }).getByRole("button", { name: "Chiqarish" }).click();
  await expectToast(page, "Bu sessiya allaqachon yopilgan", { tone: "info" });
  await expect(rows).toHaveCount(3);
  await expect(card.getByText("2 ta faol")).toBeVisible();

  // Tasdiqdagi son — barcha boshqalar: faol (Windows) + qayta kirishi kerak (iPhone).
  await card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
  await expect(confirm.getByText(/Boshqa 2 ta qurilma hisobingizdan chiqariladi/)).toBeVisible();
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
  // React Query `focusManager` oynadagi `visibilitychange` ni tinglaydi (hujjatdan ko'tariladi).
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));

  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Sessiya tugadi" })).toBeVisible();
  await expect(page.getByText("Sessiyangiz boshqa qurilmadan yopildi. Davom ettirish uchun qayta kiring.")).toBeVisible();
  // Refresh — aniq qurilma nomi bilan (`X-Device-Name`, URI-kodlangan): «Desktop Chrome» emulyatsiyasi Client
  // Hints'da Windows beradi — «Windows 10 · Chromium 147» (User-Agent zaxirasi bo'lganda «Windows · Chrome 147»).
  expect(revoke!.refreshDeviceNames.length).toBeGreaterThanOrEqual(1);
  expect(revoke!.refreshDeviceNames[0]).toMatch(/^Windows( 1[01])? · (Chromium|Chrome) \d+$/);
  // Parallel 401 lar umumiy refresh'ni kutadi; kirish sahifasida so'rovlar to'xtaydi — son o'smaydi (aylanma yo'q).
  const refreshes = revoke!.refreshes;
  const logouts = revoke!.logouts;
  await page.waitForTimeout(2_000);
  expect(revoke!.refreshes).toBe(refreshes);
  expect(revoke!.logouts).toBe(logouts);
  expect(refreshes).toBeGreaterThanOrEqual(1);
  expect(refreshes).toBeLessThanOrEqual(3);
});

test("⭐ yangi qurilma: ogohlantirish (faqat sabab — vaqt va parol maslahatisiz), amallar o'chirilgan (sababi bilan)", async ({ page }) => {
  const { leaked, availableAt } = await openProfileWithSessions(page, "superadmin", { locked: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);

  const when = formatLockTime(availableAt!);
  const notice = card.getByTestId("sessions-revoke-lock");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("role", "status");
  await expect(notice.getByText(LOCK_REASON)).toBeVisible();
  await expect(notice).toHaveText(LOCK_REASON);
  await expect(notice).not.toContainText(when);
  await expect(notice.getByRole("button")).toHaveCount(0);
  // Ogohlantirish sarlavha ostida, ro'yxat ustida.
  const noticeBox = (await notice.boundingBox())!;
  const firstRow = (await rows.nth(0).boundingBox())!;
  expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(firstRow.y + 1);

  // Amallar yashirilmaydi — o'chirilgan, sababi (vaqtsiz) yordamchi texnologiyaga va sichqoncha izohida.
  const reason = LOCK_REASON;
  const all = card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" });
  const actions = card.getByRole("button", { name: /^Chiqarish:/ });
  await expect(actions).toHaveCount(3);
  for (const target of [all, actions.nth(0), actions.nth(1), actions.nth(2)]) {
    await expect(target).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(reason);
    await expect(target).toHaveAttribute("title", reason);
  }
  await actions.nth(0).click({ force: true });
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  expect(leaked).toEqual([]);
});

test("baribir 403 SESSION_TOO_NEW: tasdiq yopiladi, sabab (vaqtsiz) ogohlantirish xabarida, ro'yxat cheklov bilan qaytadi", async ({ page }) => {
  const { leaked, revoke, state } = await openProfileWithSessions(page, "admin", { revoke: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(card.getByTestId("sessions-revoke-lock")).toHaveCount(0);

  // Ro'yxat cheklovni aytmagan (masalan, sahifa avvalroq ochilgan), server esa rad etadi.
  revoke!.tooNew = true;
  const requestsBefore = state.sessionRequests;
  await card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
  await confirm.getByRole("button", { name: "Hammasini chiqarish" }).click();

  const when = formatLockTime(revoke!.lockedUntil!);
  await expectToast(page, "Hozircha chiqarib bo'lmaydi", { tone: "warning" });
  await expectToast(page, LOCK_REASON, { tone: "warning" });
  // Server matnidagi sana ko'rsatilmaydi.
  await expect(page.getByText(`${when} dan keyin mumkin`)).toHaveCount(0);
  await expect(confirm).toBeHidden();
  await expect(page.getByText("Boshqa qurilmalardan chiqildi")).toHaveCount(0);
  await expect.poll(() => state.sessionRequests).toBeGreaterThan(requestsBefore);
  // Yangi ro'yxat — cheklov bilan: ogohlantirish va o'chirilgan amallar; qatorlar joyida.
  await expect(card.getByTestId("sessions-revoke-lock")).toHaveText(LOCK_REASON);
  await expect(card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toBeDisabled();
  await expect(rows).toHaveCount(4);
  expect(revoke!.tooNewReplies).toBe(1);
  expect(revoke!.revokeOthers).toBe(1);
  expect(leaked).toEqual([]);
});

test("faqat shu qurilma — cheklov ogohlantirishi yo'q; boshqa qurilma kirib, oynaga qaytilsa — chiqadi", async ({ page }) => {
  const { leaked, revoke } = await openProfileWithSessions(page, "superadmin", {
    revoke: true,
    initial: (state) => {
      state.sessions = state.sessions.filter((row) => row.current);
      state.lockedUntil = lockAvailableAt();
    },
  });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  // Chiqaradigan narsa yo'q — ogohlantirish ham, amal ham yo'q.
  await expect(card.getByTestId("sessions-revoke-lock")).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveCount(0);

  // Boshqa qurilmalardan kirildi; foydalanuvchi oynaga qaytadi — ro'yxat qayta so'raladi.
  revoke!.sessions = SESSIONS.sessions.map((row) => ({ ...row }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
  await expect(rows).toHaveCount(4);
  await expect(card.getByTestId("sessions-revoke-lock")).toHaveText(LOCK_REASON);
  await expect(card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toBeDisabled();
  await expect(card.getByRole("button", { name: /^Chiqarish:/ })).toHaveCount(3);
  expect(leaked).toEqual([]);
});
