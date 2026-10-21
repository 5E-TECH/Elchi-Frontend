import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoLeakRequests,
  expectOnlyOperatorOrderLinks,
  openOperatorEarnings,
  openOperatorHome,
} from "./support/marketOperatorHome";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * MO-2 — market operatori telefonda (390): pastki menyu (skanersiz, «Menyu»siz; MO-3 dan 5 katak — Bosh sahifa ·
 * Buyurtmalar · Yaratish · Mahsulotlar · Daromadim); bosh sahifa — market bosh sahifasi operator rejimida (xarajat
 * tasdiqlarisiz); «Daromadim» — «Stavkam». Sizish to'sig'i: faqat o'z marketi analitikasi so'raladi
 * (ROL-0 dagi `roles-shell.mobile.spec.ts` operator bandi shu yerga ko'chdi).
 */
test.describe.configure({ timeout: 180_000 });

const bottomNav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Asosiy bo'limlar" });

test("⭐ 390: bosh sahifa — pastki menyu 5 katak, xarajat tasdiqlari yo'q, buyurtma havolalari faqat ochiq yo'llarga, sizish yo'q", async ({
  page,
}) => {
  const mock = await openOperatorHome(page);

  const nav = bottomNav(page);
  const cells = nav.locator(":scope > a, :scope > button");
  await expect(cells).toHaveText(["Bosh sahifa", "Buyurtmalar", "Yaratish", "Mahsulotlar", "Daromadim"]);
  await expect(nav.getByRole("link", { name: "Yaratish" })).toHaveAttribute("href", "/new-orders");
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Daromadim" })).toHaveAttribute("href", "/my-earnings");
  await expect(nav.getByRole("link", { name: /Skaner/ })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Menyu" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Skanerlash/ })).toHaveCount(0);

  await expect(page.getByText("Qo'shimcha xarajat tasdiqlari")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buyurtma yaratish" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tezkor harakatlar" })).toBeVisible();
  // Profildagi ism — operatorniki, market nomi sifatida chiqmaydi.
  await expect(page.locator("[data-shell-slot=content]").getByText(/Dilnoza Karimova/)).toHaveCount(0);
  await expectOnlyOperatorOrderLinks(page);

  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expectNoLeakRequests(mock);
});

test("390: «Menyu» varaqasi yuqori paneldan — profil, Sozlamalar, Chiqish; menyu qidiruvi bor (MO-3: buyurtmalar ochiq)", async ({
  page,
}) => {
  const mock = await openOperatorHome(page);
  await expect(page.getByRole("button", { name: "Qidiruvni ochish" })).toHaveCount(1);

  await page.getByRole("button", { name: "Menyuni ochish" }).click();
  const sheet = page.getByRole("dialog", { name: "Menyu" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Profilni ochish/ })).toContainText("Market operatori");
  await expect(sheet.getByRole("searchbox")).toHaveCount(1);
  await expect(sheet.getByRole("link", { name: /Daromadim/ })).toHaveAttribute("href", "/my-earnings");
  await expect(sheet.getByRole("link", { name: /Sozlamalar/ })).toHaveAttribute("href", "/settings");
  await expect(sheet.getByRole("button", { name: "Chiqish" })).toBeVisible();
  for (const finance of ["/payments", "/cash-box", "/financial-balance", "/market-operators"]) {
    await expect(sheet.locator(`a[href="${finance}"]`)).toHaveCount(0);
  }
  expectNoLeakRequests(mock);
});

test("390: «Daromadim» — komissiya belgilanmagan: ogohlantirish va «Belgilanmagan»; faqat profil so'raladi", async ({ page }) => {
  const mock = await openOperatorEarnings(page, { commission: null });

  await expect(page.getByText("Komissiya belgilanmagan — daromad yozilmaydi")).toBeVisible();
  const card = page.getByRole("region", { name: "Stavkam" });
  await expect(card.getByText("Belgilanmagan", { exact: true })).toBeVisible();
  await expect(card.getByText("Stavka belgilanmaguncha daromad yozilmaydi. Market egasi bilan bog'laning.")).toBeVisible();
  await expect(bottomNav(page).getByRole("link", { name: "Daromadim" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/Taklif/)).toHaveCount(0);

  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expectNoLeakRequests(mock, { home: false });
});
