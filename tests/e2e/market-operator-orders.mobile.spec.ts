import { expect, test } from "@playwright/test";
import {
  expectNoForbiddenRequests,
  expectNoHorizontalOverflow,
  openOperatorCreate,
  openOperatorOrders,
} from "./support/marketOperatorOrders";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * MO-3 — market operatori telefonda (390): «Buyurtmalar» kartalar ko'rinishida (market kabi, sana qatorda,
 * «Filtrlar» varaqasida viloyat/market/kuryer yo'q), tafsilot — faqat o'qish; «Yaratish» katagi →
 * `/new-orders/create`, faqat «AI bilan». Bosiladigan har narsa ≥ 44px, gorizontal skroll yo'q.
 */
test.describe.configure({ timeout: 180_000 });

const bottomNav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Asosiy bo'limlar" });

test("⭐ 390: ro'yxat kartalari, filtr varaqasi, tafsilot; 44px va toshishsiz", async ({ page }) => {
  const mock = await openOperatorOrders(page);

  await expect(bottomNav(page).getByRole("link", { name: "Buyurtmalar" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: /Sana oralig'i/ })).toBeVisible();
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /^Filtrlar/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrlar" });
  await expect(sheet).toBeVisible();
  for (const name of ["Viloyat", "Market", "Kuryer", "Filial"]) {
    await expect(sheet.getByRole("combobox", { name })).toHaveCount(0);
  }
  await expect(sheet.getByRole("radio", { name: "Uygacha" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await page.getByRole("link", { name: /Mansur Karimov/ }).click();
  await expect(page).toHaveURL(/\/orders\/edit\/10239$/);
  await expect(page.getByText("Mansur Karimov").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /tahrirlash/i })).toHaveCount(0);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expectNoForbiddenRequests(mock);
});

test("⭐ 390: «Yaratish» katagi → «Qo'lda · AI bilan» (MO-7), AI kartalari va tasdiq paneli sig'adi", async ({ page }) => {
  const mock = await openOperatorOrders(page);

  await bottomNav(page).getByRole("link", { name: "Yaratish" }).click();
  await expect(page).toHaveURL(/\/new-orders\/create$/);
  await expect(page.getByRole("heading", { level: 1, name: "Yangi buyurtma" })).toBeVisible();
  await expect(bottomNav(page).getByRole("link", { name: "Yaratish" })).toHaveAttribute("aria-current", "page");
  // Qo'lda forma telefonda sig'adi, keyin «AI bilan».
  await expect(page.getByLabel(/^Mijoz ismi/)).toBeVisible();
  // nCAFnqIe (N12): telefonda ro'yxat o'rniga havola-karta — «Buyurtmalar» ning «Yangi» tabiga.
  const todayLink = page.getByRole("link", { name: "Bugungi yangi buyurtmalar, 1 ta" });
  await expect(todayLink).toBeVisible();
  await expect(todayLink).toHaveAttribute("href", "/orders?status=new");
  await expect(todayLink).toContainText("Baraka Shop · bugun · 1 ta");
  await expect(page.getByRole("region", { name: "Yangi buyurtmalar" })).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.getByTestId("create-mode-tabs").getByRole("radio", { name: /AI bilan/ }).click();

  await page.getByRole("textbox", { name: "Buyurtma matni" }).fill("Sevara 90 214 55 08\nMansur 93 627 18 40");
  await page.getByRole("button", { name: "Tahlil qilish" }).click();
  await expect(page.getByTestId("ai-preview-card")).toHaveCount(2);
  await expect(page.getByTestId("ai-confirm-bar")).toBeVisible();
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expectNoForbiddenRequests(mock);
});

test("390: AI o'chiq — tablarsiz qo'lda forma (MO-7)", async ({ page }) => {
  const mock = await openOperatorCreate(page, { aiEnabled: false });
  await expect(page.getByLabel(/^Mijoz ismi/)).toBeVisible();
  await expect(page.getByText("AI bilan yaratish hozir o'chiq")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Buyurtma matni" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expectNoForbiddenRequests(mock);
});
