import { expect, test } from "@playwright/test";
import { formatLockTime, lockAvailableAt, openProfileWithSessions, SESSIONS } from "./support/profileSessions";
import { expectToast } from "./support/toast";

/**
 * EP-3 (Elchi Pochta #3) — /profile «Sessiyalar» telefonda (390, kuryer): qatorlar ustma-ust (qurilma, so'ng
 * vaqtlar), «Shu qurilma» tepada, qayta kirishi kerak bo'lgani oxirida («Qayta kirish kerak»), gorizontal oqish
 * yo'q, matn ≥ 12px; «Chiqarish» va «Boshqa barcha qurilmalardan chiqish» ≥ 44 px, tasdiq — pastki varaqa.
 * Yangi qurilma (48 soat): ogohlantirish 390 ga sig'adi, o'chirilgan amallar ≥ 44 px.
 */
test.describe.configure({ timeout: 120_000 });
// Cheklov vaqti to'liq sana bilan chiziladi — brauzer vaqti foydalanuvchilarnikidek (CI esa UTC da).
test.use({ timezoneId: "Asia/Tashkent" });

const LOCK_REASON = "Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi.";

test("⭐ 390: ustma-ust qatorlar, oqish yo'q, mayda matn yo'q", async ({ page }) => {
  const { leaked } = await openProfileWithSessions(page, "courier");

  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByText("3 ta faol")).toBeVisible();
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0).getByText("Shu qurilma")).toBeVisible();
  await expect(rows.nth(0).getByText(/^Birinchi marta:/)).toBeVisible();
  await expect(rows.nth(3).getByText("Qayta kirish kerak")).toBeVisible();
  // Uzun aniq nom va belgi telefonda ham kartaga sig'adi.
  for (const index of [0, 3]) {
    const box = (await rows.nth(index).getByRole("heading", { level: 3 }).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }

  // Telefonda vaqtlar qurilma nomining ostida.
  const device = await rows.nth(0).getByRole("heading", { level: 3 }).boundingBox();
  const loggedIn = await rows.nth(0).getByText("Kirgan vaqti").boundingBox();
  expect(loggedIn?.y ?? 0).toBeGreaterThan((device?.y ?? 0) + (device?.height ?? 0));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const tiny = await card.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("*")]
      .filter((node) => node.childNodes.length && [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent?.trim()))
      .filter((node) => parseFloat(getComputedStyle(node).fontSize) < 12)
      .map((node) => node.textContent),
  );
  expect(tiny).toEqual([]);
  expect(leaked).toEqual([]);
});

test("⭐ 390: chiqarish amallari ≥ 44 px, ekranga sig'adi; tasdiq pastki varaqada; oqish yo'q", async ({ page }) => {
  const { leaked, revoke } = await openProfileWithSessions(page, "courier", { revoke: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);

  const all = card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" });
  const actions = card.getByRole("button", { name: /^Chiqarish:/ });
  await expect(actions).toHaveCount(3);
  for (const target of [all, actions.nth(0), actions.nth(1), actions.nth(2)]) {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  // Telefonda amal vaqtlar ostida (qator ustma-ust).
  const times = (await rows.nth(1).getByText("Kirgan vaqti").boundingBox())!;
  const action = (await actions.nth(0).boundingBox())!;
  expect(action.y).toBeGreaterThan(times.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await actions.nth(0).click();
  const confirm = page.getByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
  await expect(confirm).toBeVisible();
  const sheet = (await confirm.boundingBox())!;
  expect(Math.round(sheet.y + sheet.height)).toBeGreaterThanOrEqual(844 - 1);
  const submit = confirm.getByRole("button", { name: "Chiqarish" });
  // Varaqa ochilish harakati (scale/translate) tugaguncha o'lcham kasr bo'lishi mumkin (43.9999) — barqarorini kutamiz.
  await expect.poll(async () => (await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await submit.click();
  await expectToast(page, "Qurilma chiqarildi", { tone: "success" });
  await expect(rows).toHaveCount(3);
  expect(revoke!.deletes).toEqual(["s-2"]);
  expect(leaked).toEqual([]);
});

test("⭐ 390, yangi qurilma: ogohlantirish sig'adi, amallar o'chirilgan va ≥ 44 px, oqish yo'q, mayda matn yo'q", async ({ page }) => {
  const { leaked, availableAt } = await openProfileWithSessions(page, "courier", { locked: true });
  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  const rows = card.getByRole("list", { name: "Sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);

  const notice = card.getByTestId("sessions-revoke-lock");
  await notice.scrollIntoViewIfNeeded();
  await expect(notice).toHaveText(LOCK_REASON);
  await expect(notice).not.toContainText(formatLockTime(availableAt!));
  const noticeBox = (await notice.boundingBox())!;
  expect(noticeBox.x).toBeGreaterThanOrEqual(0);
  expect(noticeBox.x + noticeBox.width).toBeLessThanOrEqual(390);
  // Matn o'raladi (bir qatorga siqilmaydi): har qator ogohlantirish ichida.
  for (const line of await notice.locator("p").all()) {
    const box = (await line.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(noticeBox.x + noticeBox.width);
  }

  await expect(notice.getByRole("button")).toHaveCount(0);
  const all = card.getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" });
  const actions = card.getByRole("button", { name: /^Chiqarish:/ });
  await expect(actions).toHaveCount(3);
  for (const target of [all, actions.nth(0), actions.nth(1), actions.nth(2)]) {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  for (const target of [all, actions.nth(0), actions.nth(1), actions.nth(2)]) await expect(target).toBeDisabled();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const tiny = await card.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("*")]
      .filter((node) => node.childNodes.length && [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent?.trim()))
      .filter((node) => parseFloat(getComputedStyle(node).fontSize) < 12)
      .map((node) => node.textContent),
  );
  expect(tiny).toEqual([]);

  expect(leaked).toEqual([]);
});

test("390: faqat shu qurilma — ogohlantirish yo'q; boshqa qurilma kelsa — chiqadi va sig'adi", async ({ page }) => {
  const { leaked, revoke } = await openProfileWithSessions(page, "courier", {
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
  const notice = card.getByTestId("sessions-revoke-lock");
  const box = (await notice.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(leaked).toEqual([]);
});
