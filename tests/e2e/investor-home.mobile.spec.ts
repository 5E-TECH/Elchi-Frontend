import { expect, test, type Locator } from "@playwright/test";
import { expectNoHorizontalOverflow, openInvestorHome, shot } from "./support/investorHome";

/**
 * IN-1 — investor bosh sahifasi, telefon 390 (maketlar `investor-dashboard-home`, `-home-table`, `-mobile-menu`,
 * `-not-linked`): pastki menyu (Bosh sahifa · Investitsiya · Foyda · Menyu — IN-2), skanersiz, qidiruvsiz;
 * davr va «Grafik | Jadval» to'liq enda, ≥ 44px; jadval egizagi kartalarda; gorizontal skroll yo'q.
 */

const heights = (locator: Locator) =>
  locator.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().height)));

test("bosh sahifa: pastki menyu, «Menyu» varaqasi, boshqaruvlar ≥ 44px, jadval kartalari", async ({ page }) => {
  const mock = await openInvestorHome(page);
  await expect(page.getByText("5 ta investitsiya · oxirgisi 01.08.2026")).toBeVisible({ timeout: 30_000 });

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.locator(":scope > a, :scope > button")).toHaveText(["Bosh sahifa", "Investitsiya", "Foyda", "Menyu"]);
  await expect(nav.getByRole("link", { name: /Skaner/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Qidiruvni ochish" })).toHaveCount(0);

  for (const height of await heights(page.getByRole("radio"))) expect(height).toBeGreaterThanOrEqual(44);
  await expect(page.locator("[data-stacked-tip]")).toHaveCount(0);
  await shot(page, "investor-home--phone-light");

  await page.getByRole("radio", { name: "Jadval" }).click();
  const cards = page.getByRole("list", { name: "Oylik foyda jadvali" });
  await expect(cards.getByRole("listitem")).toHaveCount(12);
  await expect(cards.getByRole("listitem").nth(0)).toContainText("Davr hali hisoblanmagan");
  await expect(cards.getByRole("listitem").nth(1)).toContainText("Kutilmoqda: 6 200 000 so'm");
  await expect(cards.getByRole("listitem").nth(1)).toContainText("To'langan: —");
  await shot(page, "investor-home-table--phone-light");

  const profits = page.getByRole("list", { name: "Foyda tarixi" });
  await expect(profits.getByRole("listitem").first()).toContainText("Hali to'lanmagan");

  await expectNoHorizontalOverflow(page);

  await nav.getByRole("button", { name: "Menyu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menyu" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("link")).toHaveText([
    "Bosh sahifa",
    "Investitsiyalar",
    "Foyda tarixi",
  ]);
  await expect(sheet.getByRole("link", { name: /Bildirishnomalar/ })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Sozlamalar/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Chiqish" })).toBeVisible();
  await expect(sheet.getByRole("searchbox")).toHaveCount(0);
  await shot(page, "investor-home-menu--phone-light");

  expect(mock.leaked).toEqual([]);
  // Admin bosh sahifasining kompaniya so'rovlari telefonda ham ketmaydi (eski roles-shell qo'riqchisi).
  expect(mock.requested.filter((path) => /^(region\/stats|analytics)/.test(path))).toEqual([]);
});

test("404: «Investor profili hali bog'lanmagan» — tugmalar ≥ 44px, skroll yo'q", async ({ page }) => {
  await openInvestorHome(page, { status: 404, theme: "dark" });
  await expect(page.getByRole("heading", { level: 2, name: "Investor profili hali bog'lanmagan" })).toBeVisible({
    timeout: 30_000,
  });
  const buttons = page.locator("[data-investor-access]").getByRole("button");
  await expect(buttons).toHaveText(["Qayta urinish", "Chiqish"]);
  for (const height of await heights(buttons)) expect(height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
  await shot(page, "investor-home-404--phone-dark");
});
