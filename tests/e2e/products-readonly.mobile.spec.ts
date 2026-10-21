import { expect, test, type Page } from "@playwright/test";
import { mockProductsApi } from "./support/products";

/**
 * MH-1 — `/products` telefonda (390): market va market operatori faqat ko'radi (kartalar: nom · narx, amal
 * tugmalarisiz, «Faqat ko'rish…» izohi), operator marketga biriktirilmagan bo'lsa — bo'sh holat va 44 px
 * «Qayta tekshirish»; xodim kartasida narx va 44 px tahrirlash/o'chirish, tahrirlash oynasi pastki varaqa
 * («Narx», «Mahsulot rasmi»). Gorizontal oqib ketish yo'q.
 */
test.describe.configure({ timeout: 120_000 });

const noHorizontalScroll = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("⭐ 390 market: kartalarda narx, amal tugmalari yo'q, «Faqat ko'rish» izohi, yaratish tugmasi yo'q", async ({
  page,
}) => {
  await mockProductsApi(page, "market");
  await page.goto("/products");

  const cards = page.getByRole("list", { name: "Mahsulotlar" });
  await expect(cards.getByText("Mahsulot 01", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(cards.getByText(/^10\s000 so'm$/)).toBeVisible();
  await expect(
    page.getByText("Faqat ko'rish. Mahsulotni Elchi xodimlari qo'shadi va o'zgartiradi."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mahsulot yaratish" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /— tahrirlash$/ })).toHaveCount(0);
  await expect(page.getByText("Jami 14 ta mahsulot · Baraka Shop")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("⭐ 390 market operatori biriktirilmagan: bo'sh holat, «Qayta tekshirish» ≥ 44 px", async ({
  page,
}) => {
  let unassigned = true;
  await mockProductsApi(page, "market_operator", { unassigned: () => unassigned });
  await page.goto("/products");

  await expect(page.getByText("Siz hali marketga biriktirilmagansiz")).toBeVisible({
    timeout: 90_000,
  });
  const retry = page.getByRole("button", { name: "Qayta tekshirish" });
  const box = (await retry.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await noHorizontalScroll(page)).toBe(true);

  unassigned = false;
  await retry.click();
  await expect(
    page.getByRole("list", { name: "Mahsulotlar" }).getByText("Mahsulot 01", { exact: true }),
  ).toBeVisible();
});

test("⭐ 390 xodim: kartada narx va 44 px amallar, tahrirlash oynasi pastki varaqa — «Narx», «Mahsulot rasmi»", async ({
  page,
}) => {
  await mockProductsApi(page, "superadmin");
  await page.goto("/products");

  const cards = page.getByRole("list", { name: "Mahsulotlar" });
  await expect(cards.getByText("Mahsulot 01", { exact: true }).first()).toBeVisible({
    timeout: 90_000,
  });
  const edit = page.getByRole("button", { name: "Mahsulot 01 — tahrirlash" }).first();
  for (const button of [
    edit,
    page.getByRole("button", { name: "Mahsulot 01 — o'chirish" }).first(),
  ]) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(await noHorizontalScroll(page)).toBe(true);

  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Mahsulotni tahrirlash" });
  await expect(dialog.getByRole("textbox", { name: "Narx" })).toHaveValue(/^10\s000$/);
  await expect(dialog.getByText("Mahsulot rasmi")).toBeVisible();
  const sheet = (await dialog.boundingBox())!;
  expect(Math.round(sheet.y + sheet.height)).toBeGreaterThanOrEqual(844 - 1);
});
