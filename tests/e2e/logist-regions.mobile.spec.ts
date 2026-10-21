import { expect, test } from "@playwright/test";
import { expectNoFinanceRequests, expectNoHorizontalOverflow, openLogistRegions } from "./support/logistHome";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * LG-3 — logist `/regions` telefonda (390, maket `logist-regions-detail`): viloyat — `Select` «Samarqand · 86 ta»,
 * pastki menyuda «Hududlar», tumanlar reytingi + «Buyurtma bo'lmagan tumanlar», kuryerlar ro'yxat ko'rinishida,
 * nishonlar ≥ 44 px, gorizontal oqish yo'q, pul yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: Select, pastki menyu, kuryerlar ro'yxati, nishonlar ≥ 44 px, oqish yo'q", async ({ page }) => {
  const mock = await openLogistRegions(page);

  const bottom = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(bottom.getByRole("link")).toHaveText(["Bosh sahifa", "Hududlar"]);
  await expect(bottom.getByRole("link", { name: "Hududlar" })).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("radiogroup", { name: "Viloyatni tanlash" })).toHaveCount(0);
  await expect(page.getByText("Samarqand · 86 ta")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Buyurtma bo'lmagan tumanlar" })).toBeVisible();
  await expect(page.getByText("1. Jasur Tursunov")).toBeVisible();
  await expect(page.getByText("79,2% sotildi · 2 bekor")).toBeVisible();

  const text = await page.locator("[data-shell-slot=content]").innerText();
  expect(text).not.toMatch(/so'm|987|Tushum/);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
  expectNoFinanceRequests(mock);
});

test("390: viloyatni Select orqali almashtirish", async ({ page }) => {
  await openLogistRegions(page);
  await page.getByText("Samarqand · 86 ta").click();
  await page.getByRole("option", { name: "Surxondaryo · 9 ta" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Surxondaryo viloyati" })).toBeVisible();
  await expect(page).toHaveURL(/region=10/);
  await expectNoHorizontalOverflow(page);
});
