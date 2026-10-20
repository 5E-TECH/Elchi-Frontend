import { expect, test, type Page } from "@playwright/test";
import { tapTargets, tooSmall } from "./support/tapTargets";
import { ITEMS, openUsers } from "./support/usersList";

/**
 * 84IDGRDp — `/all-users` telefonda (maket `superadmin-users-list`): statistika BITTA kartada, 3 ustun
 * «Jami · Marketlar · Xodimlar» yorliq bilan (bo'sh katak yo'q); qator amali — bitta «…» tugma, sahifalash —
 * telefonda 44 px, «10 ta» yashirin; gorizontal oqib ketish yo'q (1440 / 1920 — `users-list.desktop.spec.ts`).
 */

/** Statistika kartasi (telefonda ko'rinadigan yagona «Foydalanuvchilar soni» bo'limi) yorliqlari. */
const kpiCells = (page: Page) =>
  page.getByRole("region", { name: "Foydalanuvchilar soni" }).getByText(/^(Jami|Marketlar|Xodimlar)$/);

test.describe.configure({ timeout: 180_000 });

test("⭐ 390: statistika — bitta karta, 3 ustun yorliq bilan, bo'sh katak yo'q", async ({ page }) => {
  await openUsers(page);
  const labels = kpiCells(page);
  await expect(labels).toHaveText(["Jami", "Marketlar", "Xodimlar"]);
  for (const label of await labels.all()) await expect(label).toBeVisible();
  const boxes = await labels.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON() as DOMRect));
  // Bir qatorda, chapdan o'ngga.
  for (const box of boxes) expect(Math.abs(box.top - boxes[0].top)).toBeLessThan(2);
  expect(boxes[0].left).toBeLessThan(boxes[1].left);
  expect(boxes[1].left).toBeLessThan(boxes[2].left);
  // Har yorliq ostida qiymat («1 286 ta» …) — kontekstsiz raqam yo'q.
  const cells = await labels.evaluateAll((items) => items.map((item) => (item.parentElement as HTMLElement).innerText.replace(/\s+/g, " ").trim()));
  expect(cells).toEqual([expect.stringMatching(/^Jami 1 286 ta/), expect.stringMatching(/^Marketlar 342 ta/), expect.stringMatching(/^Xodimlar 118 ta/)]);
  // Uch katak kartaning butun enini egallaydi — to'rtinchi (bo'sh) katak yo'q.
  const card = await labels.first().evaluate((item) => {
    const row = item.parentElement!.parentElement!;
    const cells = [...row.children].map((child) => child.getBoundingClientRect());
    return { width: row.getBoundingClientRect().width, cells: cells.length, used: cells.reduce((sum, cell) => sum + cell.width, 0) };
  });
  expect(card.cells).toBe(3);
  expect(card.used).toBeGreaterThan(card.width - 4);
});

test("⭐ 390: «…» amallar tugmasi va sahifalash ≥ 44×44, «10 ta» yashirin; sahifada kichik nishon yo'q", async ({ page }) => {
  await openUsers(page);
  const menus = page.getByRole("button", { name: /amallari$/ });
  await expect(menus).toHaveCount(ITEMS.length);
  for (const box of await menus.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const pager = page.getByRole("navigation", { name: /sahifa/i });
  const pagerButtons = pager.getByRole("button");
  expect(await pagerButtons.count()).toBeGreaterThan(2);
  for (const box of await pagerButtons.evaluateAll((items) =>
    items.filter((item) => item.getClientRects().length > 0).map((item) => item.getBoundingClientRect().toJSON() as DOMRect),
  )) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByText("10 ta", { exact: true })).toBeHidden();
  expect(tooSmall(await tapTargets(page))).toEqual([]);
});

test("⭐ 390px: gorizontal oqib ketish yo'q", async ({ page }) => {
  await openUsers(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
