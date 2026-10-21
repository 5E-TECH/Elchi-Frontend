import { expect, test } from "@playwright/test";
import {
  expectNoFinanceRequests,
  expectNoHorizontalOverflow,
  openLogistHome,
  openLogistRegions,
} from "./support/logistHome";

/**
 * LG-3 — logist `/regions` (desktop 1280, maket `logist-regions-detail`): menyuda «Hududlar», o'z viloyatlari tanlovi
 * (seg), `GET region/stats/:id` — spidometr, umumiy ko'rsatkichlar, tumanlar, «Kuryerlar» top 5; pul yo'q (ega LG-S1);
 * `GET /district` chaqirilmaydi; bosh sahifadagi «Tafsilot» shu sahifani ochadi; begona viloyat — bo'sh holat.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ o'z viloyati — tumanlar va kuryerlar, pulsiz; viloyat almashadi va URL'da", async ({ page }) => {
  const mock = await openLogistRegions(page);

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link")).toHaveText(["Bosh sahifa", "Hududlar"]);
  await expect(nav.getByRole("link", { name: "Hududlar" })).toHaveAttribute("aria-current", "page");

  const picker = page.getByRole("radiogroup", { name: "Viloyatni tanlash" });
  await expect(picker.getByRole("radio")).toHaveText(["Samarqand", "Qashqadaryo", "Surxondaryo"]);
  await expect(page.getByText("Toshkent")).toHaveCount(0);

  await expect(page.getByText("Buyurtmasi bor kuryerlar · viloyatda faol 6 / 8")).toBeVisible();
  const couriers = page.getByRole("table", { name: "Kuryerlar jadvali" });
  await expect(couriers.getByRole("row")).toHaveCount(6);
  await expect(couriers.getByRole("row").nth(1)).toContainText("Jasur Tursunov");
  await expect(couriers.getByRole("row").nth(1)).toContainText("Urgut tumani");
  await page.getByRole("button", { name: "Yana 2 ta kuryer" }).click();
  await expect(couriers.getByRole("row")).toHaveCount(8);

  await page.getByRole("button", { name: /^Toyloq tumani: 14 ta buyurtma/ }).click();
  await expect(page.getByRole("region", { name: "Tanlangan tuman: Toyloq tumani" })).toContainText("Kuryerlar");

  const text = await page.locator("[data-shell-slot=content]").innerText();
  expect(text).not.toMatch(/so'm|987|Tushum/);
  expect(mock.requested).not.toContain("district");
  expect(mock.detailQueries[0]).toMatch(/^6\?startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}$/);

  await picker.getByRole("radio", { name: "Qashqadaryo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Qashqadaryo viloyati" })).toBeVisible();
  await expect(page).toHaveURL(/region=8/);
  await page.getByRole("radio", { name: "Barchasi" }).click();
  await expect.poll(() => mock.detailQueries.at(-1)).toBe("8");
  await expect(page).toHaveURL(/region=8/);

  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
  expectNoFinanceRequests(mock);
});

test("bosh sahifadagi «Tafsilot» — viloyat sahifasini bosh sahifa davri bilan ochadi", async ({ page }) => {
  await openLogistHome(page);
  await page.getByRole("link", { name: "Qashqadaryo viloyati tafsiloti" }).click();
  await expect(page).toHaveURL(/\/regions\?region=8&period=today/);
  await expect(page.getByRole("radio", { name: "Bugun" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("heading", { level: 1, name: "Qashqadaryo viloyati" })).toBeVisible({ timeout: 30_000 });
});

test("begona viloyat URL'da — «Bu viloyat endi sizga biriktirilmagan», so'rov ketmaydi", async ({ page }) => {
  const mock = await openLogistRegions(page, { search: "?region=1", heading: null });
  await expect(page.getByText("Bu viloyat endi sizga biriktirilmagan")).toBeVisible({ timeout: 90_000 });
  expect(mock.detailQueries).toEqual([]);
  await expect(page).toHaveURL(/region=1/);
  await page.getByRole("radio", { name: "Surxondaryo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Surxondaryo viloyati" })).toBeVisible();
});

test("viloyat biriktirilmagan — bo'sh holat", async ({ page }) => {
  const mock = await openLogistRegions(page, { unassigned: true, heading: null });
  await expect(page.getByText("Sizga hali viloyat biriktirilmagan")).toBeVisible({ timeout: 90_000 });
  expect(mock.detailQueries).toEqual([]);
});
