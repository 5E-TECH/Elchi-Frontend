import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openMarketOperators } from "./support/marketOperators";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * MO-1 — `/market-operators` telefonda (390, market): «Menyu» varaqasida «Operatorlar» (pastki menyuda yo'q — ega
 * MO-S1), kartalar (jadval yo'q), kebab va menyu bandlari ≥ 44 px, qo'shish oynasi — pastki varaqa; bo'sh holat;
 * gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: «Menyu» varaqasidan «Operatorlar» → kartalar, nishonlar ≥ 44 px, oqish yo'q", async ({ page }) => {
  const mock = await openMarketOperators(page);
  await page.goto("/settings");

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link", { name: "Operatorlar" })).toHaveCount(0);
  await nav.getByRole("button", { name: "Menyu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menyu" });
  await sheet.getByRole("link", { name: "Operatorlar" }).click();
  await expect(page).toHaveURL(/\/market-operators$/);
  await expect(page.getByText("Madina Xoliqova").first()).toBeVisible();

  await expect(page.getByRole("table")).toHaveCount(0);
  const kebabs = page.getByRole("button", { name: / amallari$/ });
  await expect(kebabs).toHaveCount(5);
  for (const box of await kebabs.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByText("Komissiya belgilanmagan").first()).toBeVisible();
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);

  await kebabs.first().click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveText(["Komissiyani o'zgartirish", "O'chirish"]);
  for (const box of await items.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(mock.leaked).toEqual([]);
});

test("⭐ 390: «Operator qo'shish» — pastki varaqa, maydonlar ≥ 44 px", async ({ page }) => {
  await openMarketOperators(page);
  await page.getByRole("button", { name: "Operator qo'shish" }).click();
  const dialog = page.getByRole("dialog", { name: "Operator qo'shish" });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
  for (const field of [dialog.getByLabel("Ism familiya"), dialog.locator("input[type=password]")]) {
    const fieldBox = (await field.locator("xpath=..").boundingBox())!;
    expect(fieldBox.height).toBeGreaterThanOrEqual(44);
  }
  await expect(dialog.getByRole("radio", { name: "Foiz" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("390: bo'sh holat — «Hali operator yo'q», tugma bo'sh holat ichida", async ({ page }) => {
  await openMarketOperators(page, { empty: true });
  await expect(page.getByText("Hali operator yo'q")).toBeVisible();
  await expect(page.getByRole("button", { name: "Operator qo'shish" })).toHaveCount(1);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
