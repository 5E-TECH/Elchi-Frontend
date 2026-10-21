import { expect, test, type Locator } from "@playwright/test";
import { expectNoHorizontalOverflow, openInvestorPage, shot } from "./support/investorHome";

/**
 * IN-2 — «Investitsiyalar» va «Foyda tarixi», telefon 390 (maketlar `investor-investments-list`,
 * `-filtered-empty`, `investor-profits-list`): jadval → kartalar, pastki menyuda tanlangan katak, «To'lov holati»
 * to'liq enda, bosiladigan har narsa ≥ 44px, gorizontal skroll yo'q.
 */

const boxes = (locator: Locator) =>
  locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    }),
  );

test("investitsiyalar: kartalar, «22,2% hissa», sana oralig'i varaqasi, pastki menyu «Investitsiya»", async ({ page }) => {
  const mock = await openInvestorPage(page, "/investments", "Investitsiyalar");

  const cards = page.getByRole("list", { name: "Investitsiyalar ro'yxati" });
  await expect(cards.getByRole("listitem")).toHaveCount(5, { timeout: 30_000 });
  await expect(cards.getByRole("listitem").first()).toContainText("100 000 000 so'm");
  await expect(cards.getByRole("listitem").first()).toContainText("Kiritilgan: 01.08.2026");
  await expect(cards.getByRole("listitem").first()).toContainText("22,2% hissa");
  await expect(page.getByText("Jami: 450 000 000 so'm · 5 ta")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.locator(":scope > a, :scope > button")).toHaveText(["Bosh sahifa", "Investitsiya", "Foyda", "Menyu"]);
  await expect(nav.getByRole("link", { name: /Investitsiya/ })).toHaveAttribute("aria-current", "page");

  const range = page.getByRole("button", { name: /Sana oralig'i/ });
  for (const { height } of await boxes(range)) expect(height).toBeGreaterThanOrEqual(44);
  for (const { height } of await boxes(page.getByRole("navigation", { name: "Sahifalar" }).getByRole("button"))) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalOverflow(page);
  await shot(page, "investor-investments--phone-light");

  // Telefonda sana oralig'i — pastki varaqa; tez tanlov URL'ga yoziladi.
  await range.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Bu oy", exact: true }).click();
  await expect(page).toHaveURL(/\/investments\?from=\d{4}-\d{2}-01&to=/);
  await expect(page.getByText(/^Tanlangan oraliqda: /)).toBeVisible();
  expect(mock.leaked).toEqual([]);
});

test("investitsiyalar: oraliqda bo'sh — «Filtrni tozalash» ≥ 44px, skroll yo'q", async ({ page }) => {
  await openInvestorPage(page, "/investments?from=2026-09-01&to=2026-09-30", "Investitsiyalar", { theme: "dark" });
  await expect(page.getByText("Bu oraliqda investitsiya yo'q")).toBeVisible({ timeout: 30_000 });
  const clear = page.getByRole("button", { name: "Filtrni tozalash" });
  for (const { height } of await boxes(clear)) expect(height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
  await shot(page, "investor-investments-filtered-empty--phone-dark");
});

test("foyda tarixi: «To'lov holati» to'liq enda va ≥ 44px, kartalar, pastki menyu «Foyda»", async ({ page }) => {
  await openInvestorPage(page, "/profits", "Foyda tarixi");

  const cards = page.getByRole("list", { name: "Foyda yozuvlari" });
  await expect(cards.getByRole("listitem")).toHaveCount(9, { timeout: 30_000 });
  await expect(cards.getByRole("listitem").first()).toContainText("Hali to'lanmagan");
  await expect(cards.getByRole("listitem").nth(1)).toContainText("To'langan: 05.09.2026");

  const group = page.getByRole("radiogroup", { name: "To'lov holati" });
  const card = page.getByRole("region", { name: "Foyda yozuvlari" });
  const [groupBox] = await boxes(group);
  const [cardBox] = await boxes(card);
  // Karta ichki chekkasi 20 + 20 px — segment qolgan butun enni egallaydi (maket).
  expect(groupBox.width).toBeGreaterThanOrEqual(cardBox.width - 44);
  for (const { height } of await boxes(group.getByRole("radio"))) expect(height).toBeGreaterThanOrEqual(44);

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link", { name: /Foyda/ })).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalOverflow(page);
  await shot(page, "investor-profits--phone-light");

  await group.getByRole("radio", { name: "Kutilmoqda" }).click();
  await expect(page).toHaveURL(/\/profits\?status=pending$/);
  await expect(cards.getByRole("listitem")).toHaveCount(1);
});
