import { expect, test } from "@playwright/test";
import { expectNoFinanceRequests, expectNoHorizontalOverflow, openLogistHome } from "./support/logistHome";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * LG-1 — logist bosh sahifasi telefonda (390): pastki menyu «Bosh sahifa» · «Hududlar» (LG-3) · «Menyu» (skanersiz), «Viloyatlarim»
 * kartalarda, nishonlar ≥ 44 px, oqish yo'q; «Menyu» varaqasi — profil, Bildirishnomalar (+ son), Sozlamalar,
 * Chiqish, moliya bandlarisiz (maket `logist-dashboard-mobile-menu`).
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: kartalar, pastki menyu, nishonlar ≥ 44 px, oqish yo'q", async ({ page }) => {
  const mock = await openLogistHome(page);

  const bottom = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(bottom.getByRole("link")).toHaveText(["Bosh sahifa", "Hududlar"]);
  await expect(bottom.getByRole("button", { name: "Menyu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Skaner" })).toHaveCount(0);
  // Ega LG-S2: logistda global qidiruv bor (yuqori panel tugmasi).
  await expect(page.getByRole("button", { name: "Qidiruvni ochish" })).toHaveCount(1);

  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText("67,4% sotildi · 18 / 22 kuryer")).toBeVisible();
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
  expectNoFinanceRequests(mock);
});

test("390: «Menyu» varaqasi — shaxsiy bo'lim, moliyasiz", async ({ page }) => {
  const mock = await openLogistHome(page);
  await page.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("button", { name: "Menyu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menyu" });
  await expect(sheet.getByRole("link", { name: /Profilni ochish/ })).toContainText("Logist");
  // Maket: «Bildirishnomalar + son» (soxta API — 3 ta o'qilmagan).
  await expect(sheet.getByRole("link", { name: "Bildirishnomalar, 3 ta yangi" })).toHaveAttribute("href", "/inbox");
  // Menyu qidiruvi `/orders?search=` ga olib boradi — logist buyurtmalari LG-4 gacha yo'q.
  await expect(sheet.getByRole("searchbox")).toHaveCount(0);
  await expect(sheet.getByRole("link", { name: /Sozlamalar/ })).toHaveAttribute("href", "/settings");
  await expect(sheet.getByRole("button", { name: "Chiqish" })).toBeVisible();
  for (const finance of ["/payments", "/cash-box", "/financial-balance"]) {
    await expect(sheet.locator(`a[href="${finance}"]`)).toHaveCount(0);
  }
  expectNoFinanceRequests(mock);
});
