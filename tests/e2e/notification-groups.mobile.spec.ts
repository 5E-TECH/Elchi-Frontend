import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openNotificationGroups } from "./support/notificationGroups";
import { toast } from "./support/toast";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * NG-A — `/notifications` telefonda (390, admin): kartalar, kebab ≥ 44 px, pastki varaqa (sarlavha, «turi · ID»,
 * nofaolda holat qatori, bandlar ≥ 52 px), varaqadan tasdiq oynasi va `PATCH {is_active}`; gorizontal oqish yo'q.
 * NG-C (G085w5Qr): kartada va varaqada nofaollik sababi.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: kebab ≥ 44 px, sahifada kichik nishon yo'q, gorizontal oqib ketish yo'q", async ({ page }) => {
  await openNotificationGroups(page);
  await expect(page.getByRole("table")).toHaveCount(0);
  const kebabs = page.getByRole("button", { name: /guruhi: amallar$/ });
  await expect(kebabs).toHaveCount(3);
  for (const box of await kebabs.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
});

test("⭐ 390: pastki varaqa → «Faollashtirish» → tasdiq → PATCH {is_active:true}", async ({ page }) => {
  const mock = await openNotificationGroups(page);

  await page.getByRole("button", { name: "Nur Elektronika — yangi buyurtma guruhi: amallar" }).click();
  const sheet = page.getByRole("dialog", { name: "Nur Elektronika #27" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Yangi buyurtma · -1001937420815");
  await expect(sheet.getByText("Nofaol", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Xabarlar bu guruhga yuborilmayapti")).toBeVisible();
  // Varaqa pastda (ekran tagiga yopishgan).
  const sheetBox = (await sheet.boundingBox())!;
  expect(Math.round(sheetBox.y + sheetBox.height)).toBeGreaterThanOrEqual(844 - 1);

  const items = sheet.getByRole("menuitem");
  await expect(items).toHaveText(["Faollashtirish", "O'chirish"]);
  for (const box of await items.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.height).toBeGreaterThanOrEqual(52);
  }

  await sheet.getByRole("menuitem", { name: "Faollashtirish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
  await expect(dialog).toBeVisible();
  await expect(sheet).toBeHidden();
  await dialog.getByRole("button", { name: "Faollashtirish" }).click();
  await expect(toast(page, "Guruh faollashtirildi", { tone: "success" })).toBeVisible();
  expect(mock.patches).toEqual([{ id: "8", body: { is_active: true } }]);
});

test("⭐ 390 NG-C: guruh topilmadi — kartada va varaqada sabab, qizil «Nofaol», oqib ketish yo'q", async ({ page }) => {
  await openNotificationGroups(page, { inactiveReason: "chat_not_found", inactiveAt: "2026-09-28T17:45:00+05:00" });

  const card = page.getByRole("listitem").filter({ hasText: "-1001937420815" });
  await expect(card.getByText("Guruh topilmadi — ulanishni o'chirib, qayta ulang")).toBeVisible();
  await expect(card.getByText("Nofaol bo'lgan: 28.09.2026, 17:45")).toBeVisible();
  await expect(card.getByText("Nofaol", { exact: true })).toHaveClass(/bg-danger-soft/);
  await expectNoHorizontalOverflow(page);

  await card.getByRole("button", { name: "Nur Elektronika — yangi buyurtma guruhi: amallar" }).click();
  const sheet = page.getByRole("dialog", { name: "Nur Elektronika #27" });
  await expect(sheet.getByText("Guruh topilmadi — ulanishni o'chirib, qayta ulang")).toBeVisible();
  await sheet.getByRole("menuitem", { name: "Faollashtirish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
  await expect(dialog.getByRole("note")).toContainText("Guruh topilmadi");
  await expectNoHorizontalOverflow(page);
});
