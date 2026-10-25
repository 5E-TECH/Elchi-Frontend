import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openNotificationGroups } from "./support/notificationGroups";
import { toast } from "./support/toast";

/**
 * NG-A — `/notifications` adminda (ega NG-S2): yon menyuda «Bildirishnomalar» («Tizim» guruhi), qator menyusi
 * (popover: «Nofaol qilish» / «Faollashtirish», «O'chirish»; «Tahrirlash» yo'q — NG-S4), tasdiq oynalari va
 * `PATCH /notifications/:id` tanasida faqat `{ is_active }`. Planshetda (768) «Xabar turi» ustuni yashirin.
 * NG-C (G085w5Qr): nofaollik sababi — «Holat» ustunida matn va ton, faollashtirish ogohlantirishi sababga qarab.
 * 390 — `notification-groups.mobile.spec.ts`.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ admin: menyuda «Bildirishnomalar», nofaol qilish → PATCH {is_active:false}, holat «Nofaol»", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await openNotificationGroups(page);

  const nav = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Faoliyat jurnali" }) }).first();
  await expect(nav.getByRole("link", { name: "Bildirishnomalar" })).toHaveAttribute("aria-current", "page");

  const trigger = page.getByRole("button", { name: "Baraka Shop — bekor qilingan guruhi: amallar" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Baraka Shop — bekor qilingan guruhi: amallar" });
  await expect(menu.getByRole("menuitem")).toHaveText(["Nofaol qilish", "O'chirish"]);
  await expect(page.getByRole("menuitem", { name: /Tahrirlash/ })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Nofaol qilish" }).click();

  const dialog = page.getByRole("alertdialog", { name: "Nofaol qilishni tasdiqlang" });
  await expect(dialog).toContainText("Ulanish o'chirilmaydi");
  await expect(dialog).toContainText("Guruh ID: -1002184736577");
  await dialog.getByRole("button", { name: "Nofaol qilish" }).click();

  await expect(toast(page, "Guruh nofaol qilindi", { tone: "success" })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(mock.patches).toEqual([{ id: "7", body: { is_active: false } }]);
  const row = page.getByRole("row").filter({ hasText: "-1002184736577" });
  await expect(row.getByText("Nofaol", { exact: true })).toBeVisible();
  // Backend `PATCH {is_active:false}` → `inactive_reason: 'manual'` (G085w5Qr) — neytral «Qo'lda nofaol qilingan».
  await expect(row.getByText("Qo'lda nofaol qilingan")).toBeVisible();
  await expect(trigger).toBeFocused();
});

test("⭐ faollashtirish: ogohlantirish bilan tasdiq → PATCH {is_active:true}; Esc menyuni yopadi", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await openNotificationGroups(page);

  const trigger = page.getByRole("button", { name: "Nur Elektronika — yangi buyurtma guruhi: amallar" });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("menuitem", { name: "Faollashtirish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
  await expect(dialog.getByRole("note")).toContainText("Bot guruhda ekanini tekshiring");
  await expect(dialog).not.toContainText("Bot guruhdan chiqarilgan");
  await dialog.getByRole("button", { name: "Faollashtirish" }).click();

  await expect(toast(page, "Guruh faollashtirildi", { tone: "success" })).toBeVisible();
  expect(mock.patches).toEqual([{ id: "8", body: { is_active: true } }]);
  await expect(
    page.getByRole("row").filter({ hasText: "-1001937420815" }).getByText("Faol", { exact: true }),
  ).toBeVisible();
});

for (const [width, typeColumnVisible] of [
  [1440, true],
  [768, false],
] as const) {
  test(`⭐ ${width}px: gorizontal oqib ketish yo'q; «Xabar turi» ustuni ${typeColumnVisible ? "bor" : "yashirin"}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openNotificationGroups(page);
    await expectNoHorizontalOverflow(page);
    const typeHeader = page.getByRole("columnheader", { name: "Xabar turi" });
    if (typeColumnVisible) await expect(typeHeader).toBeVisible();
    else await expect(typeHeader).toBeHidden();
    // Tur har doim ko'rinadi: ustunda yoki planshetda market nomi ostida.
    await expect(
      page.getByRole("row").filter({ hasText: "-1002184736577" }).getByText("Bekor qilingan buyurtma").filter({ visible: true }),
    ).toHaveCount(1);
  });
}

test("⭐ NG-C: bot chiqarilgan — qizil «Nofaol» + sabab va sana, faollashtirishda «Bot guruhdan chiqarilgan»", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await openNotificationGroups(page, {
    inactiveReason: "kicked",
    inactiveAt: "2026-09-28T17:45:00+05:00",
  });

  const row = page.getByRole("row").filter({ hasText: "-1001937420815" });
  const badge = row.getByText("Nofaol", { exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/bg-danger-soft/);
  await expect(row.getByText("Bot guruhdan chiqarilgan — qayta qo'shing va faollashtiring")).toBeVisible();
  await expect(row.locator("time")).toHaveText("Nofaol bo'lgan: 28.09.2026, 17:45");
  await expect(row.getByText("Xabarlar bu guruhga yuborilmayapti")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Nur Elektronika — yangi buyurtma guruhi: amallar" }).click();
  await page.getByRole("menuitem", { name: "Faollashtirish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
  const note = dialog.getByRole("note");
  await expect(note).toContainText("Bot guruhdan chiqarilgan");
  await expect(note).toContainText("Avval botni shu guruhga qayta qo'shing, so'ng faollashtiring.");
  await dialog.getByRole("button", { name: "Faollashtirish" }).click();

  await expect(toast(page, "Guruh faollashtirildi", { tone: "success" })).toBeVisible();
  expect(mock.patches).toEqual([{ id: "8", body: { is_active: true } }]);
  await expect(row.getByText("Faol", { exact: true })).toBeVisible();
  await expect(row.getByText(/Bot guruhdan chiqarilgan/)).toHaveCount(0);
});
