import { expect, test } from "@playwright/test";
import { CONFLICT, mockSatoApi, openSatoCodes } from "./support/satoCodes";

/**
 * SA-1 — `/regions/sato-management?tab=sato` telefonda (390, superadmin): KPI 2 ustun, holat tablari o'rniga
 * `Select`, jadval → kartalar, kartadagi muharrir («SATO kodi *», «Bekor» · «Saqlash» ≥ 44 px), gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 120_000 });

const noOverflow = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

test("⭐ 390: Select bo'limlar, kartalar, kartadagi muharrir (409 → «Bu kod band»), ≥ 44 px", async ({ page }) => {
  const mock = await mockSatoApi(page, { patch: () => CONFLICT });
  await openSatoCodes(page);

  const kpi = page.getByRole("region", { name: "SATO solishtirish natijasi" });
  const cards = kpi.locator(":scope > *");
  const lefts = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBe(2);
  await expect(page.getByRole("tablist", { name: "SATO holati bo'yicha" })).toHaveCount(0);
  await noOverflow(page);

  await page.getByRole("combobox", { name: "SATO bo'limi: Topildi" }).click();
  await page.getByRole("option", { name: /Kodi bor/ }).click();
  await expect(page.getByRole("combobox", { name: "SATO bo'limi: Kodi bor" })).toBeVisible();
  await expect(page.getByText("Toshkent sh. · 1726290")).toBeVisible();

  const edit = page.getByRole("button", { name: "Yashnobod tumani — SATO kodini o'zgartirish" });
  expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44 - 0.01);
  await edit.click();
  const input = page.getByRole("textbox", { name: "Yashnobod tumani — SATO kodi" });
  await expect(input).toBeFocused();
  await input.fill("1726262");
  for (const name of ["Bekor", "Saqlash"]) {
    const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(box.height, `${name}: ≥ 44px`).toBeGreaterThanOrEqual(44 - 0.01);
    expect(box.x + box.width, name).toBeLessThanOrEqual(390);
  }
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByText("Bu kod band: Uchtepa tumani, Toshkent sh.")).toBeVisible();
  expect(mock.patches).toHaveLength(1);
  await noOverflow(page);

  await page.getByRole("button", { name: "Bekor", exact: true }).click();
  await expect(input).toHaveCount(0);
  expect(mock.leaked).toEqual([]);
});

test("390: «Tumanlarni o'tkazish» ↔ «SATO kodlari» tablari, sahifalash bir qatorda", async ({ page }) => {
  await mockSatoApi(page);
  await openSatoCodes(page);

  const next = page.getByRole("button", { name: "Keyingi sahifa" });
  expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44 - 0.01);
  await next.click();
  await expect(page.getByText("Zangiota tumani")).toBeVisible();
  await noOverflow(page);

  await page.getByRole("tab", { name: "Tumanlarni o'tkazish" }).click();
  await expect(page).toHaveURL(/\/regions\/sato-management$/);
  await expect(page.getByRole("combobox", { name: /SATO bo'limi/ })).toHaveCount(0);
});
